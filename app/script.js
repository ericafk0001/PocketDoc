let stream = null;
let capturedImageData = null;

const cameraBtn = document.getElementById("cameraBtn");
const uploadBtn = document.getElementById("uploadBtn");
const fileInput = document.getElementById("fileInput");
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const imagePreview = document.getElementById("imagePreview");
const captureBtn = document.getElementById("captureBtn");
const closeBtn = document.getElementById("closeBtn");
const mediaContainer = document.querySelector(".media-container");
const cameraControls = document.querySelector(".camera-controls");
const resultDiv = document.getElementById("result");
const loadingDiv = document.getElementById("loading");
const errorDiv = document.getElementById("error");
const askAiForm = document.getElementById("askAiForm");
const askAiInput = document.getElementById("askAiInput");
const chatHistory = document.getElementById("chatHistory");

// Bottom bar camera popup elements
const bottomCameraBtn = document.getElementById("bottomCameraBtn");
const cameraPopup = document.getElementById("cameraPopup");
const popupCameraBtn = document.getElementById("popupCameraBtn");
const popupUploadBtn = document.getElementById("popupUploadBtn");
const closePopupBtn = document.getElementById("closePopupBtn");

function loadConversations() {
  try {
    const raw = localStorage.getItem("pocketdoc_conversations");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function renderChatHistory() {
  if (!chatHistory) return;

  const conversations = loadConversations()
    .filter((conv) => Array.isArray(conv.messages) && conv.messages.length > 0)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 4);

  if (conversations.length === 0) {
    chatHistory.innerHTML = `
      <a href="ai.html" class="block rounded-[18px] border border-[#e3e7ee] bg-white p-3.5">
        <div class="flex items-center gap-3">
          <div class="w-14 h-14 rounded-xl bg-[#edf3ff] flex-shrink-0 grid place-items-center text-[#2f7af6]">
            <i class="bi bi-stars"></i>
          </div>
          <div class="flex-1">
            <div class="font-semibold text-[#1f3f78]">No chats yet</div>
            <div class="text-sm text-[#6f7683]">Ask your first wound-care question</div>
          </div>
        </div>
      </a>
    `;
    return;
  }

  chatHistory.innerHTML = conversations
    .map((conv) => {
      const firstUser = conv.messages.find((m) => m.role === "user");
      const preview = (firstUser?.content || "New conversation").slice(0, 70);
      const count = conv.messages.filter((m) => m.role === "user").length;
      return `
        <a href="ai.html?chat=${encodeURIComponent(conv.id)}" class="block rounded-[18px] border border-[#e3e7ee] bg-white p-3.5 hover:border-[#c7d8fb]">
          <div class="flex items-center gap-3">
            <div class="w-14 h-14 rounded-xl bg-[#edf3ff] flex-shrink-0 grid place-items-center text-[#2f7af6]">
              <i class="bi bi-chat-left-text"></i>
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-[#1f3f78] truncate">${preview || "Conversation"}</div>
              <div class="text-sm text-[#6f7683]">${count} question${count === 1 ? "" : "s"}</div>
            </div>
          </div>
        </a>
      `;
    })
    .join("");
}

async function startCamera() {
  try {
    errorDiv.style.display = "none";
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });
    video.srcObject = stream;
    video.onloadedmetadata = () => {
      video.play();
    };
    mediaContainer.style.display = "block";
    cameraControls.style.display = "flex";
    if (cameraBtn) cameraBtn.disabled = true;
    if (uploadBtn) uploadBtn.disabled = true;
  } catch (error) {
    showError("Camera access denied or not available: " + error.message);
  }
}

function captureImage() {
  const context = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0);
  capturedImageData = canvas.toDataURL("image/jpeg");
  imagePreview.src = capturedImageData;
  imagePreview.style.display = "block";
  video.style.display = "none";
  cameraControls.style.display = "none";

  setTimeout(() => predictImage(capturedImageData, "camera"), 500);
}

function closeCamera() {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
  video.srcObject = null;
  mediaContainer.style.display = "none";
  cameraControls.style.display = "none";
  imagePreview.style.display = "none";
  video.style.display = "block";
  if (cameraBtn) cameraBtn.disabled = false;
  if (uploadBtn) uploadBtn.disabled = false;
  resultDiv.style.display = "none";
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    capturedImageData = e.target.result;
    imagePreview.src = capturedImageData;
    mediaContainer.style.display = "block";
    cameraControls.style.display = "flex";
    video.style.display = "none";
    if (cameraBtn) cameraBtn.disabled = true;
    if (uploadBtn) uploadBtn.disabled = true;

    setTimeout(() => predictImage(capturedImageData, "upload"), 500);
  };
  reader.readAsDataURL(file);

  fileInput.value = "";
}

async function predictImage(imageData, source) {
  try {
    errorDiv.style.display = "none";
    loadingDiv.style.display = "block";
    resultDiv.style.display = "none";

    let response;

    if (source === "camera") {
      response = await fetch("/predict/camera", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image: imageData }),
      });
    } else {
      const formData = new FormData();

      const blob = base64ToBlob(imageData);
      formData.append("file", blob, "image.jpg");

      response = await fetch("/predict/upload", {
        method: "POST",
        body: formData,
      });
    }

    const result = await response.json();

    if (!response.ok) {
      showError(result.error || "Prediction failed");
      return;
    }

    displayResult(result);
  } catch (error) {
    showError("Error during prediction: " + error.message);
  } finally {
    loadingDiv.style.display = "none";
  }
}

function base64ToBlob(base64Data) {
  const base64 = base64Data.split(",")[1] || base64Data;
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  return new Blob([new Uint8Array(byteNumbers)], { type: "image/jpeg" });
}

function displayResult(result) {
  const resultClass = document.getElementById("resultClass");
  const resultConfidence = document.getElementById("resultConfidence");
  const confidenceFill = document.getElementById("confidenceFill");
  const allPredictions = document.getElementById("allPredictions");

  resultClass.textContent = result.class || "Unknown";
  resultConfidence.textContent = `${result.confidence.toFixed(1)}% Confidence`;
  confidenceFill.style.width = `${result.confidence}%`;

  let predictionsHtml =
    '<div class="mt-2.5 font-semibold">All Predictions:</div>';
  const sorted = Object.entries(result.all_predictions).sort(
    (a, b) => b[1] - a[1],
  );

  sorted.forEach(([className, confidence]) => {
    predictionsHtml += `
      <div class="flex justify-between py-2 border-b border-[#eef2f7] last:border-0">
        <span>${className}</span>
        <span>${confidence.toFixed(1)}%</span>
      </div>
    `;
  });

  allPredictions.innerHTML = predictionsHtml;
  mediaContainer.style.display = "none";
  resultDiv.style.display = "block";

  const learnLink = resultDiv.querySelector('a[href="ai.html"]');
  if (learnLink) {
    const prompt = `I got a ${result.class} prediction at ${result.confidence.toFixed(1)}% confidence. What should I do next?`;
    learnLink.href = `ai.html?message=${encodeURIComponent(prompt)}`;
  }
}

function showError(message) {
  errorDiv.textContent = "❌ " + message;
  errorDiv.style.display = "block";
}

// Popup management functions
function openCameraPopup() {
  cameraPopup.classList.remove("hidden");
}

function closeCameraPopup() {
  cameraPopup.classList.add("hidden");
}

// Close popup when clicking on background
cameraPopup.addEventListener("click", (e) => {
  if (e.target === cameraPopup) {
    closeCameraPopup();
  }
});

if (cameraBtn) cameraBtn.addEventListener("click", startCamera);
if (uploadBtn) uploadBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", handleFileSelect);
captureBtn.addEventListener("click", captureImage);
closeBtn.addEventListener("click", closeCamera);

// Bottom bar camera button events
bottomCameraBtn.addEventListener("click", openCameraPopup);
popupCameraBtn.addEventListener("click", () => {
  closeCameraPopup();
  startCamera();
});
popupUploadBtn.addEventListener("click", () => {
  closeCameraPopup();
  fileInput.click();
});
closePopupBtn.addEventListener("click", closeCameraPopup);

if (askAiForm && askAiInput) {
  askAiForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = askAiInput.value.trim();
    if (!message) return;
    window.location.href = `ai.html?message=${encodeURIComponent(message)}`;
  });
}

renderChatHistory();

console.log("🏥 PocketDoc app loaded successfully");
