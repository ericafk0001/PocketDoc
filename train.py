import os
import kagglehub
import tensorflow as tf
import matplotlib.pyplot as plt
import numpy as np

layers = tf.keras.layers


# ── Download Dataset ───────────────────────────────────────────────────────────

path = kagglehub.dataset_download("yasinpratomo/wound-dataset")
print("Dataset downloaded to:", path)


# ── Configuration ─────────────────────────────────────────────────────────────

DATASET_PATH  = os.path.join(path, "Wound_dataset")
IMG_SIZE      = (224, 224)       # MobileNetV2 expects 224x224
BATCH_SIZE    = 32
EPOCHS_FROZEN = 15               # Phase 1: train with base model frozen
EPOCHS_TUNED  = 10               # Phase 2: fine-tune unfrozen layers
LEARNING_RATE = 0.001
FINE_TUNE_LR  = 1e-5             # Much smaller LR for fine-tuning


# ── Load Dataset ──────────────────────────────────────────────────────────────

def load_data():
    """Load and split dataset into training and validation sets."""

    shared_args = dict(
        directory        = DATASET_PATH,
        image_size       = IMG_SIZE,
        batch_size       = BATCH_SIZE,
        seed             = 42,
        validation_split = 0.2,
    )

    train_ds = tf.keras.utils.image_dataset_from_directory(
        subset="training", **shared_args
    )
    val_ds = tf.keras.utils.image_dataset_from_directory(
        subset="validation", **shared_args
    )

    class_names = train_ds.class_names
    print(f"\n✅ Loaded {len(class_names)} classes: {class_names}\n")

    # Cache and prefetch for faster training
    AUTOTUNE = tf.data.AUTOTUNE
    train_ds = train_ds.cache().shuffle(1000).prefetch(AUTOTUNE)
    val_ds   = val_ds.cache().prefetch(AUTOTUNE)

    return train_ds, val_ds, class_names


# ── Build Model ───────────────────────────────────────────────────────────────

def build_model(num_classes):
    """
    Build a transfer learning model using MobileNetV2 as the base.

    Phase 1: Base model is frozen — only the new top layers are trained.
    Phase 2 (fine-tuning): Last 30 layers are unfrozen for refinement.
    """

    # Data augmentation applied only during training
    augment = tf.keras.Sequential([
        layers.RandomFlip("horizontal"),
        layers.RandomRotation(0.1),
        layers.RandomZoom(0.1),
    ], name="augmentation")

    # MobileNetV2 pretrained on ImageNet (no top classification layer)
    base_model = tf.keras.applications.MobileNetV2(
        input_shape = (*IMG_SIZE, 3),
        include_top = False,
        weights     = "imagenet"
    )
    base_model.trainable = False  # Freeze during Phase 1

    # Assemble the full model
    inputs  = tf.keras.Input(shape=(*IMG_SIZE, 3))
    x       = augment(inputs)
    x       = tf.keras.applications.mobilenet_v2.preprocess_input(x)
    x       = base_model(x, training=False)
    x       = layers.GlobalAveragePooling2D()(x)
    x       = layers.Dropout(0.2)(x)
    outputs = layers.Dense(num_classes, activation="softmax")(x)

    model = tf.keras.Model(inputs, outputs)

    return model, base_model


# ── Plot Results ──────────────────────────────────────────────────────────────

def plot_history(history, title="Training Results"):
    """Plot accuracy and loss curves side by side."""

    acc      = history.history["accuracy"]
    val_acc  = history.history["val_accuracy"]
    loss     = history.history["loss"]
    val_loss = history.history["val_loss"]
    epochs   = range(1, len(acc) + 1)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4))
    fig.suptitle(title)

    ax1.plot(epochs, acc,     label="Train Accuracy")
    ax1.plot(epochs, val_acc, label="Val Accuracy")
    ax1.set_title("Accuracy")
    ax1.legend()

    ax2.plot(epochs, loss,     label="Train Loss")
    ax2.plot(epochs, val_loss, label="Val Loss")
    ax2.set_title("Loss")
    ax2.legend()

    plt.tight_layout()
    plt.show()


# ── Predict on a Single Image ─────────────────────────────────────────────────

def predict(model, class_names, img_path):
    """Run inference on a single image and print the result."""

    img       = tf.keras.utils.load_img(img_path, target_size=IMG_SIZE)
    img_array = tf.keras.utils.img_to_array(img)
    img_array = np.expand_dims(img_array, axis=0)  # Add batch dimension

    predictions     = model.predict(img_array, verbose=0)
    predicted_class = class_names[np.argmax(predictions)]
    confidence      = np.max(predictions) * 100

    print(f"\n🔍 Prediction:  {predicted_class}")
    print(f"   Confidence:  {confidence:.1f}%\n")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():

    # 1. Load data
    train_ds, val_ds, class_names = load_data()

    # 2. Build model
    model, base_model = build_model(num_classes=len(class_names))
    model.summary()

    # 3. Phase 1 — Train with frozen base
    print("\n── Phase 1: Training top layers ──\n")
    model.compile(
        optimizer = tf.keras.optimizers.Adam(LEARNING_RATE),
        loss      = "sparse_categorical_crossentropy",
        metrics   = ["accuracy"]
    )
    history1 = model.fit(train_ds, validation_data=val_ds, epochs=EPOCHS_FROZEN)
    plot_history(history1, title="Phase 1: Frozen Base")

    # 4. Phase 2 — Fine-tune last 30 layers of base model
    print("\n── Phase 2: Fine-tuning ──\n")
    base_model.trainable = True
    for layer in base_model.layers[:-30]:
        layer.trainable = False

    model.compile(
        optimizer = tf.keras.optimizers.Adam(FINE_TUNE_LR),
        loss      = "sparse_categorical_crossentropy",
        metrics   = ["accuracy"]
    )
    history2 = model.fit(train_ds, validation_data=val_ds, epochs=EPOCHS_TUNED)
    plot_history(history2, title="Phase 2: Fine-Tuned")

    # 5. Save the trained model
    model.save("wound_classifier.keras")
    print("\n💾 Model saved to wound_classifier.keras")

    # 6. Example prediction (swap in a real image path to test)
    # predict(model, class_names, "./test_image.jpg")


if __name__ == "__main__":
    main()