package cn.toside.music.mobile.sourceEntry;

import org.junit.Test;
import static org.junit.Assert.*;
import java.net.Socket;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.io.ByteArrayOutputStream;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;

public class SourceEntryTest {
  private String request(LanImportServer server, String path, String origin, String auth, String body) throws Exception {
    return requestWithHost(server,path,origin,auth,body,"127.0.0.1:"+server.getListeningPort());
  }
  private String requestWithHost(LanImportServer server, String path, String origin, String auth, String body, String host) throws Exception {
    try (Socket socket = new Socket("127.0.0.1", server.getListeningPort())) {
      socket.setSoTimeout(5000);
      byte[] payload = body.getBytes(StandardCharsets.UTF_8);
      String headers = "POST " + path + " HTTP/1.1\r\nHost: " + host
        + "\r\nOrigin: " + origin + "\r\nAuthorization: " + auth
        + "\r\nContent-Type: application/x-www-form-urlencoded\r\nContent-Length: " + payload.length + "\r\nConnection: close\r\n\r\n";
      socket.getOutputStream().write(headers.getBytes(StandardCharsets.UTF_8));
      socket.getOutputStream().write(payload);
      ByteArrayOutputStream result = new ByteArrayOutputStream();
      byte[] buffer = new byte[2048]; int n;
      while ((n = socket.getInputStream().read(buffer)) != -1) result.write(buffer, 0, n);
      return result.toString("UTF-8");
    }
  }
  @Test public void wrongHostAndOversizedBodiesNeverReachImport() throws Exception {
    LanImportServer server=new LanImportServer("127.0.0.1","html",(k,u,e)->{ fail("must not import");return null; });
    server.start();
    try {
      assertTrue(requestWithHost(server,"/api/pair",server.getAddress(),"","code="+server.getPairCode(),"example.com").contains("403"));
      assertTrue(request(server,"/api/import",server.getAddress(),"Bearer "+server.getToken(),new String(new char[16385]).replace('\0','x')).contains("413"));
      assertTrue(request(server,"/api/import",server.getAddress(),"Bearer "+server.getToken(),"kind=script&enable=true&url=file%3A%2F%2Fa").contains("400"));
    } finally { server.stop(); }
  }
  @Test public void pairingLocksAfterFiveFailuresAndNewSessionsRejectOldTokens() throws Exception {
    LanImportServer first=new LanImportServer("127.0.0.1","html",(k,u,e)->new LanImportServer.Outcome(true,"saved"));
    first.start();String oldToken=first.getToken();
    try {
      for(int i=0;i<5;i++) assertTrue(request(first,"/api/pair",first.getAddress(),"","code=0000000").contains("403"));
      assertTrue(request(first,"/api/pair",first.getAddress(),"","code="+first.getPairCode()).contains("429"));
    } finally { first.stop(); }
    LanImportServer next=new LanImportServer("127.0.0.1","html",(k,u,e)->{fail("must not import");return null;});
    next.start();
    try { assertTrue(request(next,"/api/import",next.getAddress(),"Bearer "+oldToken,"kind=script&enable=true&url=https%3A%2F%2Fexample.com").contains("401")); }
    finally { next.stop(); }
  }
  @Test public void pairingAndImportRequireSessionAndSameOrigin() throws Exception {
    final int[] calls = {0};
    LanImportServer server = new LanImportServer("127.0.0.1", "<html>local</html>", (kind, url, enable) -> {
      calls[0]++; assertEquals("subscription", kind); assertEquals("https://example.com/sources.json?a=x%2By", url);
      return new LanImportServer.Outcome(true, "saved");
    });
    server.start();
    try {
      String origin = server.getAddress();
      String form = "kind=subscription&enable=true&url=" + URLEncoder.encode("https://example.com/sources.json?a=x%2By", "UTF-8");
      assertTrue(request(server, "/api/import", origin, "", form).contains("401"));
      assertTrue(request(server, "/api/pair", "https://example.com", "", "code=" + server.getPairCode()).contains("403"));
      assertTrue(request(server, "/api/pair", origin, "", "code=0000000").contains("403"));
      String pair = request(server, "/api/pair", origin, "", "code=" + server.getPairCode());
      assertTrue(pair.contains(server.getToken()));
      assertTrue(request(server, "/api/import", origin, "Bearer " + server.getToken(), form).contains("saved"));
      assertEquals(1, calls[0]);
      assertTrue(server.getAccessUrl().contains("/#token="));
    } finally { server.stop(); }
  }
  @Test public void expiredAndMalformedSessionsCannotImport() throws Exception {
    LanImportServer server = new LanImportServer("127.0.0.1", "html", (k,u,e) -> { fail("must not import"); return null; }, 1);
    server.start();
    try { Thread.sleep(20); assertTrue(request(server, "/api/import", server.getAddress(), "Bearer " + server.getToken(), "kind=script").contains("410")); }
    finally { server.stop(); }
  }
  @Test public void qrDecoderPreservesLongAddress() throws Exception {
    String text = "https://example.com/sources.json?token=a%2Bb%3D&more=" + new String(new char[100]).replace('\0','x');
    BitMatrix code = new QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, 512, 512);
    int[] pixels = new int[512 * 512];
    for (int y=0;y<512;y++) for(int x=0;x<512;x++) pixels[y*512+x] = code.get(x,y) ? 0xff000000 : 0xffffffff;
    assertEquals(text, QrDecoder.decode(512,512,pixels));
  }
}
