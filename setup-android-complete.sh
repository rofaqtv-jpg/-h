#!/bin/bash

echo "🤖 Setting up complete Android project..."

ANDROID_DIR="native/android"

# Create directory structure
mkdir -p $ANDROID_DIR/app/src/main/java/com/turrini/drivingsim
mkdir -p $ANDROID_DIR/app/src/main/res/layout
mkdir -p $ANDROID_DIR/app/src/main/res/values
mkdir -p $ANDROID_DIR/app/src/main/res/drawable
mkdir -p $ANDROID_DIR/app/src/main/res/mipmap-anydpi-v26
mkdir -p $ANDROID_DIR/app/src/main/assets
mkdir -p $ANDROID_DIR/gradle/wrapper

# Download gradle wrapper JAR
echo "📥 Downloading Gradle wrapper..."
curl -L "https://raw.githubusercontent.com/gradle/gradle/v8.5.0/gradle/wrapper/gradle-wrapper.jar" \
  -o $ANDROID_DIR/gradle/wrapper/gradle-wrapper.jar

if [ ! -f "$ANDROID_DIR/gradle/wrapper/gradle-wrapper.jar" ]; then
    echo "❌ Failed to download gradle-wrapper.jar"
    exit 1
fi

echo "✅ Android project structure created!"
echo ""
echo "Next steps:"
echo "1. Copy your Java files to app/src/main/java/com/turrini/drivingsim/"
echo "2. Copy your XML layouts to app/src/main/res/layout/"
echo "3. Copy web files to app/src/main/assets/"
echo "4. Run: cd native/android && ./gradlew assembleDebug"
