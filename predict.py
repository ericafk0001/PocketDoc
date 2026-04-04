import tensorflow as tf
import numpy as np

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

# ── Predict ───────────────────────────────────────────────────────────────────

def predict(img_path):
    """Run inference on a single image and print the result."""

    img       = tf.keras.utils.load_img(img_path, target_size=IMG_SIZE)
    img_array = tf.keras.utils.img_to_array(img)
    img_array = np.expand_dims(img_array, axis=0)  # Add batch dimension

    predictions     = model.predict(img_array, verbose=0)
    predicted_class = CLASS_NAMES[np.argmax(predictions)]
    confidence      = np.max(predictions) * 100

    print(f"🔍 Prediction:  {predicted_class}")
    print(f"   Confidence:  {confidence:.1f}%")

# ── Run ───────────────────────────────────────────────────────────────────────

predict("./IMG_2144.jpg")  