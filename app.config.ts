{
  "expo": {
    "name": "Metardu Access",
    "slug": "metardu-access",
    "version": "0.1.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "metardu",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "org.metardu.access",
      "infoPlist": {
        "NSCameraUsageDescription": "Metardu Access uses the camera to capture geotagged beacon and site photos for survey records.",
        "NSLocationWhenInUseUsageDescription": "Metardu Access needs your location to capture GPS coordinates for survey points.",
        "NSLocationAlwaysAndWhenInUseUsageDescription": "Metardu Access needs background location to log continuous traverses and GNSS tracks during fieldwork.",
        "NSLocationAlwaysUsageDescription": "Metardu Access needs background location to log continuous traverses and GNSS tracks during fieldwork.",
        "NSBluetoothAlwaysUsageDescription": "Metardu Access uses Bluetooth to connect to total stations and GNSS RTK receivers.",
        "NSBluetoothPeripheralUsageDescription": "Metardu Access uses Bluetooth to connect to total stations and GNSS RTK receivers.",
        "NSPhotoLibraryUsageDescription": "Metardu Access saves survey photos and exports to your photo library.",
        "NSMicrophoneUsageDescription": "Metardu Access uses the microphone for voice notes attached to field observations.",
        "UIBackgroundModes": [
          "location",
          "fetch",
          "bluetooth-central"
        ]
      },
      "entitlements": {
        "com.apple.developer.networking.networkextension": []
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#0B1F3A"
      },
      "package": "org.metardu.access",
      "permissions": [
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_BACKGROUND_LOCATION",
        "android.permission.CAMERA",
        "android.permission.BLUETOOTH",
        "android.permission.BLUETOOTH_ADMIN",
        "android.permission.BLUETOOTH_SCAN",
        "android.permission.BLUETOOTH_CONNECT",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_LOCATION",
        "android.permission.INTERNET",
        "android.permission.ACCESS_NETWORK_STATE",
        "android.permission.VIBRATE"
      ]
    },
    "web": {
      "bundler": "metro",
      "output": "static",
      "favicon": "./assets/images/favicon.png"
    },
    "plugins": [
      "expo-router",
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#0B1F3A"
        }
      ],
      [
        "expo-camera",
        {
          "cameraPermissionText": "Metardu Access uses the camera to capture geotagged beacon and site photos.",
          "microphonePermissionText": "Metardu Access uses the microphone for voice notes attached to field observations."
        }
      ],
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Metardu Access needs location access to capture GPS coordinates and log traverses."
        }
      ],
      "expo-secure-store",
      "expo-font"
    ],
    "experiments": {
      "typedRoutes": true
    },
    "extra": {
      "eas": {
        "projectId": ""
      },
      "router": {
        "origin": false
      }
    },
    "owner": "error302",
    "runtimeVersion": {
      "policy": "appVersion"
    },
    "updates": {
      "url": "https://u.expo.dev/",
      "enabled": true,
      "fallbackToCacheTimeout": 0
    }
  }
}
