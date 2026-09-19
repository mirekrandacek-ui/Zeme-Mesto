# Project-specific R8 / ProGuard rules.

# Keep Capacitor plugin classes and callback methods that are discovered at runtime.
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * {
    @com.getcapacitor.annotation.PermissionCallback <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
    @com.getcapacitor.annotation.Permission <methods>;
    @com.getcapacitor.PluginMethod public <methods>;
}
-keep public class * extends com.getcapacitor.Plugin { *; }

# Keep Cordova plugin entry points used by Capacitor's Cordova compatibility layer.
-keep public class * extends org.apache.cordova.* {
    public <methods>;
    public <fields>;
}

# Preserve source and line information so Play Console can retrace crashes accurately.
-keepattributes SourceFile,LineNumberTable
