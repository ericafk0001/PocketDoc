import tensorflow as tf
import numpy as np

try:
    from pillow_heif import register_heif_opener

    register_heif_opener()
    print("✅ HEIC/HEIF support enabled")
except ImportError:
    # Optional: regular image formats still work without pillow-heif.
    print("⚠️ HEIC/HEIF support unavailable (install pillow-heif)")

# ── Configuration ─────────────────────────────────────────────────────────────

MODEL_PATH = "./wound_classifier.keras"
IMG_SIZE   = (224, 224)
CLASS_NAMES = [
    "Abrasions", "Bruises", "Burns", "Cut",
    "Diabetic Wounds", "Laceration", "Normal", "Pressure Wounds"
]

# ── Load Model ────────────────────────────────────────────────────────────────

model = tf.keras.models.load_model(MODEL_PATH)
print("✅ Model loaded successfully\n")

# Keep labels aligned with the model output dimensions.
MODEL_OUTPUT_CLASSES = int(model.output_shape[-1])
if MODEL_OUTPUT_CLASSES <= len(CLASS_NAMES):
    ACTIVE_CLASS_NAMES = CLASS_NAMES[:MODEL_OUTPUT_CLASSES]
else:
    extra = [f"Class_{i}" for i in range(len(CLASS_NAMES), MODEL_OUTPUT_CLASSES)]
    ACTIVE_CLASS_NAMES = CLASS_NAMES + extra

if MODEL_OUTPUT_CLASSES != len(CLASS_NAMES):
    print(
        f"⚠️ Class label mismatch: model outputs {MODEL_OUTPUT_CLASSES}, "
        f"configured labels {len(CLASS_NAMES)}. Using {len(ACTIVE_CLASS_NAMES)} labels."
    )

# ── Predict ───────────────────────────────────────────────────────────────────

def predict(img_path):
    """Run inference on a single image and print the result."""

    img       = tf.keras.utils.load_img(img_path, target_size=IMG_SIZE)
    img_array = tf.keras.utils.img_to_array(img)
    img_array = np.expand_dims(img_array, axis=0)  # Add batch dimension

    predictions     = model.predict(img_array, verbose=0)
    predicted_class = ACTIVE_CLASS_NAMES[int(np.argmax(predictions[0]))]
    confidence      = np.max(predictions) * 100

    print(f"🔍 Prediction:  {predicted_class}")
    print(f"   Confidence:  {confidence:.1f}%")

# ── Run ───────────────────────────────────────────────────────────────────────

predict("./IMG_2144.jpg")  