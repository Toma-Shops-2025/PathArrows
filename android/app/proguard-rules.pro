# Capacitor plugins
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * {
    @com.getcapacitor.annotation.PermissionCallback <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
    @com.getcapacitor.annotation.Permission <methods>;
    @com.getcapacitor.PluginMethod public <methods>;
}

-keep public class * extends com.getcapacitor.Plugin { *; }

-keep @com.getcapacitor.NativePlugin public class * {
    @com.getcapacitor.PluginMethod public <methods>;
}

-keep public class * extends org.apache.cordova.* {
    public <methods>;
    public <fields>;
}

# Unity Ads
-keep class com.unity3d.** { *; }
-dontwarn com.unity3d.**

-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
