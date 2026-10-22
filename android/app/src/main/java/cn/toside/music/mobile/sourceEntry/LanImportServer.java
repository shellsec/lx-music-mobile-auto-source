package cn.toside.music.mobile.sourceEntry;

import fi.iki.elonen.NanoHTTPD;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

/** Temporary, paired LAN-only import endpoint. No filesystem serving or remote assets. */
public final class LanImportServer extends NanoHTTPD {
  public interface ImportHandler { Outcome submit(String kind, String url, boolean enable) throws Exception; }
  public static final class Outcome {
    public final boolean success; public final String message;
    public Outcome(boolean success, String message) { this.success=success; this.message=message; }
  }
  public static final long SESSION_MILLIS = 10 * 60 * 1000L;
  private final String host, html, token, pairCode;
  private final ImportHandler handler;
  private final long startedNanos = System.nanoTime(), ttlMillis;
  private final AtomicInteger failures = new AtomicInteger();
  private final AtomicBoolean busy = new AtomicBoolean();
  private volatile boolean closed;

  public LanImportServer(String host, String html, ImportHandler handler) { this(host, html, handler, SESSION_MILLIS); }
  LanImportServer(String host, String html, ImportHandler handler, long ttlMillis) {
    super(host, 0);
    this.host=host; this.html=html; this.handler=handler; this.ttlMillis=ttlMillis;
    SecureRandom random = new SecureRandom();
    byte[] bytes = new byte[24]; random.nextBytes(bytes);
    StringBuilder text = new StringBuilder();
    for(byte value:bytes) text.append(String.format(java.util.Locale.ROOT, "%02x", value & 255));
    token=text.toString(); pairCode=String.valueOf(100000 + random.nextInt(900000));
  }
  public String getAddress() { return "http://" + host + ":" + getListeningPort(); }
  public String getAccessUrl() { return getAddress() + "/#token=" + token; }
  public String getToken() { return token; }
  public String getPairCode() { return pairCode; }
  public boolean isExpired() { return closed || (System.nanoTime()-startedNanos)/1000000 >= ttlMillis; }
  @Override public void stop() { closed=true; super.stop(); }

  private static String quote(String value) {
    StringBuilder out=new StringBuilder("\"");
    for(char c:value.toCharArray()) {
      if(c=='\\' || c=='\"') out.append('\\').append(c);
      else if(c<32) out.append(String.format(java.util.Locale.ROOT,"\\u%04x",(int)c));
      else out.append(c);
    }
    return out.append('\"').toString();
  }
  private Response response(Response.Status status, boolean ok, String message) {
    return secure(newFixedLengthResponse(status,"application/json; charset=utf-8","{\"ok\":"+ok+",\"message\":"+quote(message)+"}"));
  }
  private Response secure(Response response) {
    response.addHeader("Cache-Control","no-store, max-age=0");
    response.addHeader("Referrer-Policy","no-referrer");
    response.addHeader("X-Content-Type-Options","nosniff");
    response.addHeader("Content-Security-Policy","default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    return response;
  }
  private boolean equal(String left, String right) {
    return left!=null && right!=null && MessageDigest.isEqual(left.getBytes(StandardCharsets.UTF_8),right.getBytes(StandardCharsets.UTF_8));
  }
  @Override public Response serve(IHTTPSession session) {
    if(isExpired()) return response(Response.Status.GONE,false,"配置服务已关闭或过期，请在手机上重新开启");
    String expectedHost=host+":"+getListeningPort();
    if(!expectedHost.equalsIgnoreCase(session.getHeaders().get("host"))) return response(Response.Status.FORBIDDEN,false,"访问地址不匹配");
    if(session.getMethod()==Method.GET && "/".equals(session.getUri())) return secure(newFixedLengthResponse(Response.Status.OK,"text/html; charset=utf-8",html));
    if(session.getMethod()!=Method.POST) return response(Response.Status.METHOD_NOT_ALLOWED,false,"不支持此请求");
    if(!getAddress().equals(session.getHeaders().get("origin"))) return response(Response.Status.FORBIDDEN,false,"请从手机显示的配置地址打开网页");
    String path=session.getUri();
    if(!"/api/pair".equals(path) && !"/api/import".equals(path)) return response(Response.Status.NOT_FOUND,false,"页面不存在");
    if("/api/import".equals(path) && !equal(session.getHeaders().get("authorization"),"Bearer "+token)) return response(Response.Status.UNAUTHORIZED,false,"请先配对或扫描手机上的访问二维码");
    try {
      String length=session.getHeaders().get("content-length");
      if(length==null || Integer.parseInt(length)<1 || Integer.parseInt(length)>16384 || session.getHeaders().containsKey("transfer-encoding")) return response(Response.Status.PAYLOAD_TOO_LARGE,false,"请求内容过大或格式不正确");
      String contentType=session.getHeaders().get("content-type");
      if(contentType==null || !contentType.startsWith("application/x-www-form-urlencoded")) return response(Response.Status.UNSUPPORTED_MEDIA_TYPE,false,"请求格式不正确");
      session.parseBody(new HashMap<String,String>());
      Map<String,String> values=session.getParms();
      if("/api/pair".equals(path)) {
        if(failures.get()>=5) return response(Response.Status.TOO_MANY_REQUESTS,false,"配对失败次数过多，请在手机上重新开启服务");
        if(!equal(values.get("code"),pairCode)) { failures.incrementAndGet(); return response(Response.Status.FORBIDDEN,false,"配对码不正确"); }
        return secure(newFixedLengthResponse(Response.Status.OK,"application/json; charset=utf-8","{\"ok\":true,\"token\":"+quote(token)+"}"));
      }
      String kind=values.get("kind"),url=values.get("url"),enable=values.get("enable");
      if(!"script".equals(kind) && !"subscription".equals(kind)) return response(Response.Status.BAD_REQUEST,false,"请选择添加类型");
      if(!"true".equals(enable) && !"false".equals(enable)) return response(Response.Status.BAD_REQUEST,false,"启用选项无效");
      if(url==null || url.trim().isEmpty() || url.length()>4096 || url.matches("(?s).*\\s.*")) return response(Response.Status.BAD_REQUEST,false,"请输入有效链接");
      URI uri=new URI(url);
      if(!("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme())) || uri.getRawAuthority()==null) return response(Response.Status.BAD_REQUEST,false,"仅支持 HTTP 或 HTTPS 链接");
      if(!busy.compareAndSet(false,true)) return response(Response.Status.CONFLICT,false,"正在添加源，请稍后再试");
      try {
        Outcome outcome=handler.submit(kind,url,"true".equals(enable));
        if(isExpired()) return response(Response.Status.GONE,false,"配置服务已关闭");
        return response(outcome.success ? Response.Status.OK : Response.Status.BAD_REQUEST,outcome.success,outcome.message);
      } finally { busy.set(false); }
    } catch(Exception error) { return response(Response.Status.BAD_REQUEST,false,"请求失败，请检查地址或重新开启服务"); }
  }
}
