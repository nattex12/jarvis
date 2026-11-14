"""Fail packaging if the TV launcher, test identity or either ARM ABI is missing."""
import re
import subprocess
import sys
import zipfile

apk, aapt = sys.argv[1:]
badging = subprocess.check_output([aapt, "dump", "badging", apk], text=True)
assert "package: name='com.jarvis.app.tvtest'" in badging, "Wrong test package"
assert "sdkVersion:'24'" in badging, "Minimum Android version changed"
assert "leanback-launchable-activity:" in badging, "No TV launcher activity"
required = set(re.findall(r"uses-feature: name='([^']+)'", badging))
for feature in ("android.hardware.touchscreen", "android.hardware.telephony",
                "android.hardware.camera", "android.hardware.microphone"):
    assert feature not in required, f"TV would require {feature}"
manifest = subprocess.check_output([aapt, "dump", "xmltree", apk, "AndroidManifest.xml"], text=True)
assert "android:banner" in manifest, "Missing TV banner"
with zipfile.ZipFile(apk) as archive:
    names = archive.namelist()
    abis = {name.split('/')[1] for name in names if name.startswith('lib/') and name.endswith('.so')}
    assert abis == {"arm64-v8a", "armeabi-v7a"}, f"Unexpected APK ABIs: {abis}"
    for abi in ("arm64-v8a", "armeabi-v7a"):
        for library in ("libjarvis_studio_gui_lib.so", "libonnxruntime.so",
                        "libonnxruntime4j_jni.so", "libmediapipe_tasks_jni.so"):
            assert f"lib/{abi}/{library}" in names, f"Missing {abi}/{library}"
print("TV packaging passed: test identity, API 24, launcher, banner, optional hardware, both ARM ABIs.")
