const fs = require('fs');
const path = require('path');
const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
  withMainActivity,
  withMainApplication,
} = require('@expo/config-plugins');

const MODULE_NAME = 'VideoCallPip';

function getPackagePath(androidPackage) {
  return androidPackage.split('.').join('/');
}

function addMainActivityPip(contents) {
  if (contents.includes('VideoCallPipModule.enterPictureInPicture')) {
    return contents;
  }

  const imports = [
    'import android.content.res.Configuration',
    'import android.os.Build',
  ];

  let next = contents;
  for (const line of imports) {
    if (!next.includes(line)) {
      next = next.replace(/package [^\n]+\n/, (match) => `${match}\n${line}\n`);
    }
  }

  const override = `
  override fun onUserLeaveHint() {
    super.onUserLeaveHint()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && VideoCallPipModule.shouldEnterPictureInPicture(this)) {
      VideoCallPipModule.enterPictureInPicture(this)
    }
  }

  override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean, newConfig: Configuration) {
    super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
    VideoCallPipModule.setInPictureInPictureMode(isInPictureInPictureMode)
  }
`;

  return next.replace(/\n}\s*$/, `${override}\n}\n`);
}

function addMainApplicationPackage(contents) {
  let next = contents;

  if (!next.includes('import com.oney.WebRTCModule.WebRTCModuleOptions')) {
    next = next.replace(
      /package [^\n]+\n/,
      (match) => `${match}\nimport com.oney.WebRTCModule.WebRTCModuleOptions\n`
    );
  }

  if (!next.includes('VideoCallPipPackage')) {
    next = next.replace(
      /val packages = PackageList\(this\)\.packages\n/,
      'val packages = PackageList(this).packages\n      packages.add(VideoCallPipPackage())\n'
    );
  }

  if (!next.includes('enableMediaProjectionService = true')) {
    next = next.replace(
      /super\.onCreate\(\)\n/,
      'super.onCreate()\n    WebRTCModuleOptions.getInstance().enableMediaProjectionService = true\n'
    );
  }

  return next;
}

function writeNativeModule(projectRoot, androidPackage) {
  const packageDir = path.join(
    projectRoot,
    'android',
    'app',
    'src',
    'main',
    'java',
    ...getPackagePath(androidPackage).split('/')
  );
  fs.mkdirSync(packageDir, { recursive: true });

  const modulePath = path.join(packageDir, `${MODULE_NAME}Module.java`);
  const packagePath = path.join(packageDir, `${MODULE_NAME}Package.java`);

  fs.writeFileSync(
    modulePath,
    `package ${androidPackage};

import android.app.Activity;
import android.app.PictureInPictureParams;
import android.content.Context;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;
import android.util.Rational;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;

public class ${MODULE_NAME}Module extends ReactContextBaseJavaModule {
  private static final Rational VIDEO_CALL_ASPECT_RATIO = new Rational(9, 16);
  private static volatile boolean callActive = false;
  private static volatile boolean inPictureInPictureMode = false;

  public ${MODULE_NAME}Module(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @Override
  public String getName() {
    return "${MODULE_NAME}";
  }

  @ReactMethod
  public void setCallActive(boolean active) {
    callActive = active;
    configureAutoEnter(getCurrentActivity(), active);
  }

  @ReactMethod
  public void enterPictureInPicture(Promise promise) {
    Activity activity = getCurrentActivity();
    promise.resolve(enterPictureInPicture(activity));
  }

  @ReactMethod
  public void getAvailableAudioOutputs(Promise promise) {
    WritableArray outputs = Arguments.createArray();
    outputs.pushString("earpiece");
    outputs.pushString("speaker");

    AudioManager audioManager = (AudioManager) getReactApplicationContext().getSystemService(Context.AUDIO_SERVICE);
    boolean hasBluetooth = false;

    if (audioManager != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      AudioDeviceInfo[] devices = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS);
      for (AudioDeviceInfo device : devices) {
        int type = device.getType();
        if (
          type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP ||
          type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
          (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && type == AudioDeviceInfo.TYPE_BLE_HEADSET)
        ) {
          hasBluetooth = true;
          break;
        }
      }
    }

    if (hasBluetooth) {
      outputs.pushString("bluetooth");
    }

    promise.resolve(outputs);
  }

  public static boolean shouldEnterPictureInPicture(Activity activity) {
    return callActive
      && activity != null
      && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
      && !inPictureInPictureMode;
  }

  public static boolean enterPictureInPicture(Activity activity) {
    if (!shouldEnterPictureInPicture(activity)) {
      return false;
    }

    try {
      PictureInPictureParams params = buildParams(true);
      return activity.enterPictureInPictureMode(params);
    } catch (RuntimeException error) {
      return false;
    }
  }

  public static void setInPictureInPictureMode(boolean active) {
    inPictureInPictureMode = active;
  }

  private static void configureAutoEnter(Activity activity, boolean active) {
    if (activity == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return;
    }

    try {
      activity.setPictureInPictureParams(buildParams(active));
    } catch (RuntimeException ignored) {
    }
  }

  private static PictureInPictureParams buildParams(boolean autoEnter) {
    PictureInPictureParams.Builder builder = new PictureInPictureParams.Builder()
      .setAspectRatio(VIDEO_CALL_ASPECT_RATIO);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      builder.setAutoEnterEnabled(autoEnter);
    }

    return builder.build();
  }
}
`
  );

  fs.writeFileSync(
    packagePath,
    `package ${androidPackage};

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class ${MODULE_NAME}Package implements ReactPackage {
  @Override
  public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
    List<NativeModule> modules = new ArrayList<>();
    modules.add(new ${MODULE_NAME}Module(reactContext));
    return modules;
  }

  @Override
  public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
    return Collections.emptyList();
  }
}
`
  );
}

module.exports = function withAndroidVideoCallPip(config) {
  config = withAndroidManifest(config, (manifestConfig) => {
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(manifestConfig.modResults);
    mainActivity.$['android:supportsPictureInPicture'] = 'true';
    mainActivity.$['android:resizeableActivity'] = 'true';

    const configChanges = mainActivity.$['android:configChanges'] || '';
    const requiredChanges = ['screenSize', 'smallestScreenSize', 'screenLayout', 'orientation'];
    const mergedChanges = new Set(configChanges.split('|').filter(Boolean));
    requiredChanges.forEach((change) => mergedChanges.add(change));
    mainActivity.$['android:configChanges'] = [...mergedChanges].join('|');

    return manifestConfig;
  });

  config = withMainActivity(config, (activityConfig) => {
    if (activityConfig.modResults.language === 'kt') {
      activityConfig.modResults.contents = addMainActivityPip(activityConfig.modResults.contents);
    }
    return activityConfig;
  });

  config = withMainApplication(config, (applicationConfig) => {
    if (applicationConfig.modResults.language === 'kt') {
      applicationConfig.modResults.contents = addMainApplicationPackage(applicationConfig.modResults.contents);
    }
    return applicationConfig;
  });

  config = withDangerousMod(config, [
    'android',
    (dangerousConfig) => {
      const androidPackage = dangerousConfig.android?.package;
      if (!androidPackage) {
        throw new Error('android.package is required for the video call PiP plugin.');
      }

      writeNativeModule(dangerousConfig.modRequest.projectRoot, androidPackage);
      return dangerousConfig;
    },
  ]);

  return config;
};
