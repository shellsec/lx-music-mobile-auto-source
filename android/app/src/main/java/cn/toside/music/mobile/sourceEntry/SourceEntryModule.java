package cn.toside.music.mobile.sourceEntry;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import com.facebook.react.bridge.*;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.android.Intents;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.journeyapps.barcodescanner.ScanOptions;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

public final class SourceEntryModule extends ReactContextBaseJavaModule implements LifecycleEventListener {
  private static final int SCAN_REQUEST=27831;
  private final ReactApplicationContext context;
  private final ExecutorService executor=Executors.newSingleThreadExecutor();
  private final Handler timer=new Handler(Looper.getMainLooper());
  private final ConcurrentHashMap<String,Pending> pending=new ConcurrentHashMap<>();
  private volatile LanImportServer server;
  private volatile boolean destroyed;
  private final AtomicInteger generation=new AtomicInteger();
  private Promise scanPromise;
  private final Runnable expiry=() -> stopInternal();
  private final BaseActivityEventListener activityListener=new BaseActivityEventListener() {
    @Override public void onActivityResult(Activity activity,int requestCode,int resultCode,Intent data) {
      if(requestCode!=SCAN_REQUEST) return;
      Promise result=scanPromise; scanPromise=null;
      if(result==null) return;
      if(resultCode==Activity.RESULT_OK && data!=null) result.resolve(data.getStringExtra(Intents.Scan.RESULT));
      else result.resolve(null);
    }
  };
  private static final class Pending {
    final CountDownLatch done=new CountDownLatch(1);
    volatile LanImportServer.Outcome result=new LanImportServer.Outcome(false,"配置服务已关闭或操作超时");
  }
  SourceEntryModule(ReactApplicationContext context) {
    super(context); this.context=context;
    context.addActivityEventListener(activityListener); context.addLifecycleEventListener(this);
  }
  @Override public String getName() { return "SourceEntryModule"; }
  @ReactMethod public void addListener(String event) {}
  @ReactMethod public void removeListeners(double count) {}
  private void emit(String name,WritableMap value) {
    if(!destroyed && context.hasActiveCatalystInstance()) context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit(name,value);
  }
  @ReactMethod public void scan(Promise promise) {
    Activity activity=getCurrentActivity();
    if(activity==null) { promise.reject("NO_ACTIVITY","请在应用前台打开扫一扫"); return; }
    activity.runOnUiThread(() -> {
      if(scanPromise!=null) { promise.reject("BUSY","扫码已打开"); return; }
      scanPromise=promise;
      try {
        ScanOptions options=new ScanOptions().setDesiredBarcodeFormats(ScanOptions.QR_CODE).setCaptureActivity(SourceCaptureActivity.class)
          .setPrompt("扫描源链接或订阅二维码").setBeepEnabled(false).setOrientationLocked(true);
        activity.startActivityForResult(options.createScanIntent(activity),SCAN_REQUEST);
      } catch(Exception error) { scanPromise=null; promise.reject("SCAN_FAILED","无法打开相机，请检查相机权限",error); }
    });
  }
  private InputStream openImage(String path) throws Exception {
    Uri uri=Uri.parse(path);
    if(uri.getScheme()==null) uri=Uri.fromFile(new File(path));
    InputStream stream=context.getContentResolver().openInputStream(uri);
    if(stream==null) throw new Exception("图片无法读取");
    return stream;
  }
  @ReactMethod public void decodeImage(String path,Promise promise) {
    executor.execute(() -> {
      Bitmap bitmap=null;
      try {
        BitmapFactory.Options bounds=new BitmapFactory.Options(); bounds.inJustDecodeBounds=true;
        try(InputStream input=openImage(path)) { BitmapFactory.decodeStream(input,null,bounds); }
        if(bounds.outWidth<1 || bounds.outHeight<1) throw new Exception("图片格式不支持");
        BitmapFactory.Options options=new BitmapFactory.Options(); options.inSampleSize=1;
        while(bounds.outWidth/options.inSampleSize>2048 || bounds.outHeight/options.inSampleSize>2048) {
          if(options.inSampleSize==0) options.inSampleSize=1;
          options.inSampleSize*=2;
        }
        options.inPreferredConfig=Bitmap.Config.ARGB_8888;
        try(InputStream input=openImage(path)) { bitmap=BitmapFactory.decodeStream(input,null,options); }
        if(bitmap==null) throw new Exception("图片无法解码");
        int width=bitmap.getWidth(),height=bitmap.getHeight();
        int[] pixels=new int[width*height];bitmap.getPixels(pixels,0,width,0,0,width,height);
        promise.resolve(QrDecoder.decode(width,height,pixels));
      } catch(OutOfMemoryError error) { promise.reject("IMAGE_TOO_LARGE","图片过大，请裁剪二维码后重试"); }
      catch(Exception error) { promise.reject("NO_QR","未识别到二维码，请选择清晰图片或裁剪后重试"); }
      finally { if(bitmap!=null) bitmap.recycle(); }
    });
  }
  private String lanHost() throws Exception {
    for(NetworkInterface network:Collections.list(NetworkInterface.getNetworkInterfaces())) {
      String name=network.getName().toLowerCase(java.util.Locale.ROOT);
      if(!network.isUp() || network.isLoopback() || !(name.contains("wlan") || name.startsWith("wifi") || name.startsWith("ap") || name.startsWith("swlan") || name.startsWith("eth"))) continue;
      for(InetAddress address:Collections.list(network.getInetAddresses())) {
        if(address instanceof Inet4Address && address.isSiteLocalAddress() && !address.isLoopbackAddress()) return address.getHostAddress();
      }
    }
    throw new Exception("未找到局域网地址，请连接 Wi-Fi 或开启热点后重试");
  }
  private String page() throws Exception {
    try(InputStream input=context.getAssets().open("source-entry.html")) {
      ByteArrayOutputStream bytes=new ByteArrayOutputStream();byte[] buffer=new byte[4096];int n;
      while((n=input.read(buffer))!=-1) bytes.write(buffer,0,n);
      return new String(bytes.toByteArray(),StandardCharsets.UTF_8);
    }
  }
  private String qrImage(String text) throws Exception {
    BitMatrix qr=new QRCodeWriter().encode(text,BarcodeFormat.QR_CODE,480,480);
    Bitmap bitmap=Bitmap.createBitmap(480,480,Bitmap.Config.ARGB_8888);
    try {
      int[] pixels=new int[480*480];
      for(int y=0;y<480;y++) for(int x=0;x<480;x++) pixels[y*480+x]=qr.get(x,y)?0xff000000:0xffffffff;
      bitmap.setPixels(pixels,0,480,0,0,480,480);
      ByteArrayOutputStream output=new ByteArrayOutputStream();bitmap.compress(Bitmap.CompressFormat.PNG,100,output);
      return "data:image/png;base64,"+Base64.encodeToString(output.toByteArray(),Base64.NO_WRAP);
    } finally { bitmap.recycle(); }
  }
  private LanImportServer.Outcome submit(String sessionId,String kind,String url,boolean enable) throws Exception {
    LanImportServer current=server;
    if(current==null || current.isExpired() || !current.getToken().equals(sessionId)) return new LanImportServer.Outcome(false,"配置服务已关闭");
    String id=UUID.randomUUID().toString();Pending request=new Pending();pending.put(id,request);
    try {
      WritableMap event=Arguments.createMap();event.putString("id",id);event.putString("session",sessionId);
      event.putString("kind",kind);event.putString("url",url);event.putBoolean("enable",enable);
      event.putDouble("expiresAt",System.currentTimeMillis()+175000);
      emit("source-entry-request",event);
      if(!request.done.await(180,TimeUnit.SECONDS)) return new LanImportServer.Outcome(false,"处理超时，请在手机上检查结果");
      return request.result;
    } finally { pending.remove(id); }
  }
  @ReactMethod public void completeRequest(String id,boolean ok,String message) {
    Pending request=pending.get(id);
    if(request!=null) { request.result=new LanImportServer.Outcome(ok,message.substring(0,Math.min(message.length(),1000)));request.done.countDown(); }
  }
  @ReactMethod public void startServer(Promise promise) {
    final int intent=generation.get();
    executor.execute(() -> {
      try { promise.resolve(startInternal(intent)); }
      catch(Exception error) { stopInternal();promise.reject("SERVER_FAILED",error.getMessage(),error); }
    });
  }
  private synchronized WritableMap startInternal(int intent) throws Exception {
    if(intent!=generation.get()) throw new Exception("启动已取消，请重新开启");
    if(destroyed || context.getLifecycleState()!=com.facebook.react.common.LifecycleState.RESUMED) throw new Exception("请保持应用在前台");
    stopInternal();
    final LanImportServer[] reference=new LanImportServer[1];
    LanImportServer next=new LanImportServer(lanHost(),page(),(kind,url,enable) -> submit(reference[0].getToken(),kind,url,enable));
    reference[0]=next;server=next;next.start(NanoTimeout.VALUE,true);
    timer.postDelayed(expiry,LanImportServer.SESSION_MILLIS);
    WritableMap result=Arguments.createMap();result.putString("id",next.getToken());result.putString("address",next.getAddress());
    result.putString("code",next.getPairCode());result.putString("qrImage",qrImage(next.getAccessUrl()));
    result.putDouble("expiresAt",System.currentTimeMillis()+LanImportServer.SESSION_MILLIS);
    return result;
  }
  private static final class NanoTimeout { static final int VALUE=5000; }
  @ReactMethod public void stopServer(Promise promise) { stopInternal();promise.resolve(null); }
  private synchronized void stopInternal() {
    generation.incrementAndGet();
    timer.removeCallbacks(expiry);
    LanImportServer previous=server;server=null;
    for(Pending request:pending.values()) request.done.countDown();pending.clear();
    if(previous!=null) { previous.stop();emit("source-entry-stopped",Arguments.createMap()); }
  }
  @Override public void onHostResume() {}
  @Override public void onHostPause() { stopInternal(); }
  @Override public void onHostDestroy() { stopInternal(); }
  @Override public void invalidate() {
    stopInternal();destroyed=true;
    if(scanPromise!=null) { scanPromise.resolve(null);scanPromise=null; }
    context.removeActivityEventListener(activityListener);context.removeLifecycleEventListener(this);executor.shutdownNow();super.invalidate();
  }
}
