#!/bin/bash
# =============================================================================
# iOS BUILD SCRIPT
# =============================================================================
# Usage:
#   ./scripts/build-ios.sh [profile]
#
# Profiles:
#   development - Simulator build for local testing
#   preview     - Ad-hoc/Internal distribution for QA testing
#   production  - App Store build for TestFlight/Production
# =============================================================================

set -e

PROFILE=${1:-preview}

echo "======================================"
echo "  AUVO FIELD - iOS Build"
echo "======================================"
echo "Profile: $PROFILE"
echo ""

# Validate profile
case $PROFILE in
  development|preview|production)
    ;;
  *)
    echo "Error: Invalid profile '$PROFILE'"
    echo "Valid profiles: development, preview, production"
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
eas build --profile "$PROFILE" --platform ios --non-interactive

echo ""
echo "======================================"
echo "  Build completed!"
echo "======================================"
echo ""
echo "To download the build:"
echo "  eas build:list --platform ios"
echo ""
echo "To submit to TestFlight (production only):"
echo "  eas submit --platform ios --profile production"
echo ""
