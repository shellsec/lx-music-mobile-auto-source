package cn.toside.music.mobile.sourceEntry;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.BinaryBitmap;
import com.google.zxing.DecodeHintType;
import com.google.zxing.MultiFormatReader;
import com.google.zxing.RGBLuminanceSource;
import com.google.zxing.common.HybridBinarizer;
import java.util.Collections;
import java.util.EnumMap;
import java.util.Map;

public final class QrDecoder {
  private QrDecoder() {}
  public static String decode(int width,int height,int[] pixels) throws Exception {
    Map<DecodeHintType,Object> hints=new EnumMap<>(DecodeHintType.class);
    hints.put(DecodeHintType.POSSIBLE_FORMATS,Collections.singletonList(BarcodeFormat.QR_CODE));
    hints.put(DecodeHintType.TRY_HARDER,Boolean.TRUE);
    RGBLuminanceSource source=new RGBLuminanceSource(width,height,pixels);
    MultiFormatReader reader=new MultiFormatReader();
    try { return reader.decode(new BinaryBitmap(new HybridBinarizer(source)),hints).getText(); }
    catch(com.google.zxing.NotFoundException missing) { return reader.decode(new BinaryBitmap(new HybridBinarizer(source.invert())),hints).getText(); }
    finally { reader.reset(); }
  }
}
