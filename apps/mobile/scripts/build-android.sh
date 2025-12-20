#!/bin/bash
# =============================================================================
# ANDROID BUILD SCRIPT
# =============================================================================
# Usage:
#   ./scripts/build-android.sh [profile]
#
# Profiles:
#   development - Debug APK for local testing
#   preview     - Release APK for QA testing
#   preview-aab - Release AAB for Play Store internal testing
#   production  - Release AAB for Play Store production
# =============================================================================

set -e

PROFILE=${1:-preview}

echo "======================================"
echo "  AUVO FIELD - Android Build"
echo "======================================"
echo "Profile: $PROFILE"
echo ""

# Validate profile
case $PROFILE in
  development|preview|preview-aab|production)
    ;;
  *)
    echo "Error: Invalid profile '$PROFILE'"
    echo "Valid profiles: development, preview, preview-aab, production"
    exit 1
    ;;
esac

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo "Error: EAS CLI not found. Install with: npm install -g eas-cli"
    exit 1
fi

# Check if logged in
if ! eas whoami &> /dev/null; then
    echo "Error: Not logged into EAS. Run: eas login"
    exit 1
fi

echo ""
echo "Starting build..."
echo ""

# Run build
eas build --profile "$PROFILE" --platform android --non-interactive

echo ""
echo "======================================"
echo "  Build completed!"
echo "======================================"
echo ""
echo "To download the build:"
echo "  eas build:list --platform android"
echo ""
echo "To submit to Play Store (production only):"
echo "  eas submit --platform android --profile production"
echo ""
