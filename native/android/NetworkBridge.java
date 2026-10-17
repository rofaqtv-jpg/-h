package com.turrini.drivingsim;

import android.content.Context;
import android.net.wifi.WifiManager;
import android.webkit.JavascriptInterface;
import android.util.Log;

import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.Enumeration;

public class NetworkBridge {
    private Context context;
    private static final String TAG = "NetworkBridge";

    public NetworkBridge(Context context) {
        this.context = context;
    }

    @JavascriptInterface
    public String getLocalIP() {
        return MainActivity.getLocalIPAddress();
    }

    @JavascriptInterface
    public boolean isWifiConnected() {
        try {
            WifiManager wifi = (WifiManager) context.getApplicationContext()
                .getSystemService(Context.WIFI_SERVICE);
            return wifi.isWifiEnabled() && wifi.getConnectionInfo() != null;
        } catch (Exception e) {
            return false;
        }
    }

    @JavascriptInterface
    public String getNetworkInfo() {
        try {
            WifiManager wifi = (WifiManager) context.getApplicationContext()
                .getSystemService(Context.WIFI_SERVICE);
            String ssid = wifi.getConnectionInfo().getSSID();
            String ip = getLocalIP();
            return "{\"ssid\":\"" + ssid + "\",\"ip\":\"" + ip + "\"}";
        } catch (Exception e) {
            return "{\"error\":\"" + e.getMessage() + "\"}";
        }
    }

    @JavascriptInterface
    public void log(String message) {
        Log.d(TAG, message);
    }
        }
