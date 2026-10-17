# Add project specific ProGuard rules here.
-keep class com.turrini.drivingsim.** { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
