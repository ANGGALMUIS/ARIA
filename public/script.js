// ===============================
// IMPORT
// ===============================
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";

// ===============================
// GLOBAL
// ===============================
let currentVrm = null;

const clock = new THREE.Clock();

let currentSpeech = null;

let isSpeaking = false;

let isListening = false;

// ===============================
// THREE JS SETUP
// ===============================
const videoElement = document.getElementById("webcam");

const canvas = document.createElement("canvas");

canvas.id = "canvas3d";

document.body.appendChild(canvas);

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
});

renderer.setSize(window.innerWidth, window.innerHeight);

renderer.setPixelRatio(window.devicePixelRatio);

renderer.outputEncoding = THREE.sRGBEncoding;

// ===============================
// SCENE
// ===============================
const scene = new THREE.Scene();

// ===============================
// CAMERA
// ===============================
const camera = new THREE.PerspectiveCamera(
  30,
  window.innerWidth / window.innerHeight,
  0.1,
  20,
);

camera.position.set(0, 0, 1.2);

// ===============================
// LIGHT
// ===============================
const light = new THREE.DirectionalLight(0xffffff, 1);

light.position.set(1, 1, 1);

scene.add(light);

scene.add(new THREE.AmbientLight(0xffffff, 0.7));

// ===============================
// LOAD VRM
// ===============================
const loader = new GLTFLoader();

loader.register((parser) => {
  return new VRMLoaderPlugin(parser);
});

loader.load(
  "char/karakter.vrm",

  (gltf) => {
    const vrm = gltf.userData.vrm;

    console.log("VRM Loaded");

    scene.add(vrm.scene);

    vrm.scene.rotation.y = Math.PI;

    vrm.scene.position.y = -1.2;

    vrm.scene.rotation.x = 0.05;

    vrm.scene.traverse((obj) => {
      obj.frustumCulled = false;
    });

    currentVrm = vrm;

    startTracking();
  },

  undefined,

  (error) => {
    console.error(error);
  },
);

// ===============================
// HELPER
// ===============================
const tempEuler = new THREE.Euler();

const tempQuat = new THREE.Quaternion();

function rigBone(
  vrm,
  boneName,
  rotation = { x: 0, y: 0, z: 0 },
  dampener = 1,
  lerpAmount = 0.3,
) {
  if (!vrm) return;

  const bone = vrm.humanoid.getNormalizedBoneNode(boneName);

  if (!bone) return;

  rotation.x = Math.max(-1.5, Math.min(1.5, rotation.x));

  rotation.y = Math.max(-1.5, Math.min(1.5, rotation.y));

  rotation.z = Math.max(-1.5, Math.min(1.5, rotation.z));

  tempEuler.set(
    rotation.x * dampener,
    rotation.y * dampener,
    rotation.z * dampener,
    "XYZ",
  );

  tempQuat.setFromEuler(tempEuler);

  bone.quaternion.slerp(tempQuat, lerpAmount);
}

// ===============================
// ANIMATE VRM
// ===============================
function animateVRM(vrm, results) {
  if (!vrm) return;

  if (!window.Kalidokit) return;

  // FACE
  if (results.faceLandmarks) {
    const faceRig = window.Kalidokit.Face.solve(results.faceLandmarks, {
      runtime: "mediapipe",
      video: videoElement,
    });

    if (faceRig) {
      rigBone(
        vrm,
        "neck",
        {
          x: faceRig.head.x * 0.5,
          y: faceRig.head.y * 0.5,
          z: -faceRig.head.z * 0.5,
        },
        0.7,
        0.18,
      );

      rigBone(
        vrm,
        "head",
        {
          x: faceRig.head.x * 0.5,
          y: faceRig.head.y * 0.5,
          z: -faceRig.head.z * 0.5,
        },
        0.7,
        0.18,
      );

      if (vrm.expressionManager) {
        const mouthOpen = isSpeaking
          ? 0.5 + Math.random() * 0.5
          : faceRig.mouth.shape.A;

        vrm.expressionManager.setValue("aa", mouthOpen);

        vrm.expressionManager.setValue("blinkLeft", 1 - faceRig.eye.l);

        vrm.expressionManager.setValue("blinkRight", 1 - faceRig.eye.r);
      }
    }
  }

  // BODY
  if (results.poseLandmarks) {
    const poseRig = window.Kalidokit.Pose.solve(
      results.poseLandmarks,
      results.poseLandmarks,
      {
        runtime: "mediapipe",
        video: videoElement,
      },
    );

    if (poseRig) {
      rigBone(
        vrm,
        "hips",
        {
          x: 0,
          y: poseRig.Hips?.rotation?.y || 0,
          z: 0,
        },
        0.7,
        0.07,
      );

      rigBone(
        vrm,
        "spine",
        {
          x: poseRig.Spine?.x || 0,
          y: poseRig.Spine?.y || 0,
          z: poseRig.Spine?.z || 0,
        },
        0.25,
        0.15,
      );

      rigBone(
        vrm,
        "chest",
        {
          x: poseRig.Spine?.x || 0,
          y: poseRig.Spine?.y || 0,
          z: poseRig.Spine?.z || 0,
        },
        0.15,
        0.15,
      );

      rigBone(
        vrm,
        "rightUpperArm",
        {
          x: poseRig.RightUpperArm?.x || 0,
          y: poseRig.RightUpperArm?.y || 0,
          z: poseRig.RightUpperArm?.z || 0,
        },
        1.3,
        0.35,
      );

      rigBone(
        vrm,
        "rightLowerArm",
        {
          x: poseRig.RightLowerArm?.x || 0,
          y: poseRig.RightLowerArm?.y || 0,
          z: poseRig.RightLowerArm?.z || 0,
        },
        1.3,
        0.35,
      );

      rigBone(
        vrm,
        "leftUpperArm",
        {
          x: poseRig.LeftUpperArm?.x || 0,
          y: poseRig.LeftUpperArm?.y || 0,
          z: poseRig.LeftUpperArm?.z || 0,
        },
        1.3,
        0.35,
      );

      rigBone(
        vrm,
        "leftLowerArm",
        {
          x: poseRig.LeftLowerArm?.x || 0,
          y: poseRig.LeftLowerArm?.y || 0,
          z: poseRig.LeftLowerArm?.z || 0,
        },
        1.3,
        0.35,
      );
    }
  }
}

// ===============================
// AVATAR VISIBILITY (FADE via CSS)
// ===============================
// Menggunakan CSS transition pada canvas — lebih reliable untuk VRM
// karena material VRM tidak selalu support opacity traversal
let faceDetected = false;
let faceGoneTimeout = null;

const FADE_DELAY_MS = 700; // delay sebelum fade out dimulai
const FADE_DURATION = "0.4s"; // durasi transisi CSS

// Terapkan style awal
canvas.style.transition = `opacity ${FADE_DURATION} ease`;
canvas.style.opacity = "1";

function setAvatarDetected(detected) {
  if (detected) {
    // WAJAH TERDETEKSI — batalkan timer, fade in
    clearTimeout(faceGoneTimeout);
    faceGoneTimeout = null;
    faceDetected = true;
    canvas.style.opacity = "1";
  } else {
    // WAJAH HILANG — tunggu dulu baru fade out
    if (faceDetected) {
      faceDetected = false;
      clearTimeout(faceGoneTimeout);
      faceGoneTimeout = setTimeout(() => {
        canvas.style.opacity = "0";
      }, FADE_DELAY_MS);
    }
  }
}

// ===============================
// RENDER LOOP
// ===============================
function animate() {
  requestAnimationFrame(animate);

  if (currentVrm) {
    currentVrm.update(clock.getDelta());
  }

  renderer.render(scene, camera);
}

animate();

// ===============================
// START TRACKING
// ===============================
function startTracking() {
  const holistic = new window.Holistic({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
    },
  });

  holistic.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.65,
    minTrackingConfidence: 0.65,
    refineFaceLandmarks: true,
  });

  holistic.onResults((results) => {
    document.getElementById("dbg-face").textContent = results.faceLandmarks
      ? "✅"
      : "❌";

    document.getElementById("dbg-right").textContent =
      results.rightHandLandmarks ? "✅" : "❌";

    document.getElementById("dbg-left").textContent = results.leftHandLandmarks
      ? "✅"
      : "❌";

    document.getElementById("dbg-pose").textContent = results.poseLandmarks
      ? "✅"
      : "❌";

    // FADE AVATAR BERDASARKAN DETEKSI WAJAH
    setAvatarDetected(!!results.faceLandmarks);

    animateVRM(currentVrm, results);
  });

  const cameraUtils = new window.Camera(videoElement, {
    onFrame: async () => {
      await holistic.send({
        image: videoElement,
      });
    },

    width: 640,
    height: 480,
  });

  cameraUtils.start();
}

// ===============================
// RESIZE
// ===============================
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ===============================
// UI ELEMENTS
// ===============================
const btnMic = document.getElementById("btn-mic");
const statusText = document.getElementById("status-text");
const chatText = document.getElementById("chat-text");
const manualInput = document.getElementById("manual-input");
const btnSend = document.getElementById("btn-send");

// HISTORY ELEMENTS
const historyBtn = document.getElementById("history-btn");
const historyPanel = document.getElementById("history-panel");
const historyList = document.getElementById("history-list");
const historyEmpty = document.getElementById("history-empty");
const historyBadge = document.getElementById("history-badge");
const historyClear = document.getElementById("history-clear");

// ===============================
// OPENAI API KEY
// ===============================
window.OPENAI_API_KEY = "";

// ===============================
// HISTORY STATE
// ===============================
let historyOpen = false;
let unreadCount = 0;

// TOGGLE PANEL
historyBtn.addEventListener("click", () => {
  historyOpen = !historyOpen;

  if (historyOpen) {
    historyPanel.classList.remove("closed");
    historyPanel.classList.add("open");

    // RESET BADGE
    unreadCount = 0;
    historyBadge.textContent = "0";
    historyBadge.classList.add("hidden");
  } else {
    historyPanel.classList.remove("open");
    historyPanel.classList.add("closed");
  }
});

// TUTUP SAAT KLIK DI LUAR
document.addEventListener("click", (e) => {
  if (
    historyOpen &&
    !historyPanel.contains(e.target) &&
    !historyBtn.contains(e.target)
  ) {
    historyOpen = false;
    historyPanel.classList.remove("open");
    historyPanel.classList.add("closed");
  }
});

// CLEAR HISTORY
historyClear.addEventListener("click", () => {
  historyList.innerHTML = "";
  historyList.appendChild(historyEmpty);
  historyEmpty.style.display = "block";
  unreadCount = 0;
  historyBadge.textContent = "0";
  historyBadge.classList.add("hidden");
});

// TAMBAH ITEM KE HISTORY
function addToHistory(who, msg) {
  // SEMBUNYIKAN EMPTY
  historyEmpty.style.display = "none";

  const item = document.createElement("div");

  item.className = `history-item ${who === "user" ? "user-item" : "aria-item"}`;

  item.innerHTML = `
    <div class="h-who">${who === "user" ? "Anda" : "ARIA"}</div>
    <div class="h-msg">${msg}</div>
  `;

  historyList.appendChild(item);

  // SCROLL KE BAWAH
  historyList.scrollTop = historyList.scrollHeight;

  // UPDATE BADGE KALAU PANEL TERTUTUP
  if (!historyOpen) {
    unreadCount++;
    historyBadge.textContent = unreadCount;
    historyBadge.classList.remove("hidden");
  }
}

// ===============================
// AUTO FADE HELPER
// ===============================
function autoFadeChat() {
  clearTimeout(window.chatHideTimeout);

  window.chatHideTimeout = setTimeout(() => {
    chatText.style.transition = "opacity 0.5s";
    chatText.style.opacity = "0";

    setTimeout(() => {
      chatText.innerText = "Tekan mic atau ketik pesan untuk mulai bicara!";
      chatText.style.opacity = "1";
    }, 500);
  }, 10000);
}

// ===============================
// OPENAI CHAT
// ===============================
async function tanyaAI(pesan) {
  if (!window.OPENAI_API_KEY || window.OPENAI_API_KEY.trim() === "") {
    return "Masukkan API Key OpenAI.";
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${window.OPENAI_API_KEY}`,
      },

      body: JSON.stringify({
        model: "gpt-4o-mini",

        messages: [
          {
            role: "system",
            content:
              "Nama kamu Aria, asisten virtual hologram AI yang natural, santai, ramah, dan futuristik.",
          },
          {
            role: "user",
            content: pesan,
          },
        ],

        temperature: 0.8,
        max_tokens: 120,
      }),
    });

    if (!response.ok) {
      console.log(await response.text());
      return "API Error.";
    }

    const data = await response.json();

    return data.choices[0].message.content;
  } catch (err) {
    console.error(err);
    return "Koneksi bermasalah.";
  }
}

// ===============================
// TEXT TO SPEECH
// ===============================
function ucapkanBalasan(text) {
  window.speechSynthesis.cancel();

  currentSpeech = new SpeechSynthesisUtterance(text);

  const voices = window.speechSynthesis.getVoices();

  const indoVoice = voices.find(
    (v) => v.lang.includes("id") || v.name.toLowerCase().includes("indonesia"),
  );

  if (indoVoice) currentSpeech.voice = indoVoice;

  currentSpeech.lang = "id-ID";
  currentSpeech.rate = 0.95;
  currentSpeech.pitch = 1;
  currentSpeech.volume = 1;

  currentSpeech.onstart = () => {
    isSpeaking = true;
    statusText.innerText = "Status: Berbicara...";
  };

  currentSpeech.onend = () => {
    isSpeaking = false;
    statusText.innerText = "Status: Menunggu...";
  };

  currentSpeech.onerror = () => {
    isSpeaking = false;
    statusText.innerText = "Status: Error suara";
  };

  window.speechSynthesis.speak(currentSpeech);
}

// ===============================
// SHARED: PROSES BALASAN AI
// ===============================
async function prosesBalasan(pesan) {
  statusText.innerText = "Status: Berpikir...";

  const jawaban = await tanyaAI(pesan);

  chatText.innerText = "ARIA: " + jawaban;

  // SIMPAN KE HISTORY
  addToHistory("aria", jawaban);

  autoFadeChat();

  setTimeout(() => {
    ucapkanBalasan(jawaban);
  }, 300);
}

// ===============================
// TEXT INPUT — ENTER & SEND BUTTON
// ===============================
async function kirimPesan() {
  const pesan = manualInput.value.trim();

  if (!pesan) return;

  manualInput.value = "";

  chatText.innerText = "Anda: " + pesan;

  // SIMPAN KE HISTORY
  addToHistory("user", pesan);

  await prosesBalasan(pesan);
}

// ENTER KEY
manualInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    kirimPesan();
  }
});

// SEND BUTTON
btnSend.addEventListener("click", () => {
  kirimPesan();
});

// ===============================
// SPEECH RECOGNITION
// ===============================
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  chatText.innerText = "Browser tidak mendukung Speech Recognition.";
} else {
  const recognition = new SpeechRecognition();

  recognition.lang = "id-ID";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let finalTranscript = "";

  // ===============================
  // MIC BUTTON
  // ===============================
  btnMic.addEventListener("click", () => {
    // STOP AI SPEAKING
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      isSpeaking = false;
      statusText.innerText = "Status: Suara dihentikan";
      return;
    }

    // START / STOP MIC
    if (!isListening) {
      window.speechSynthesis.cancel();
      recognition.start();
      isListening = true;
      statusText.innerText = "Status: Mendengarkan...";
    } else {
      recognition.stop();
      isListening = false;
      statusText.innerText = "Status: Stop";
    }
  });

  // ===============================
  // RESULT
  // ===============================
  recognition.onresult = async (event) => {
    let interimTranscript = "";

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const transcript = event.results[i][0].transcript;

      if (event.results[i].isFinal) {
        finalTranscript += transcript + " ";
      } else {
        interimTranscript += transcript;
      }
    }

    chatText.innerText = "Anda: " + finalTranscript + interimTranscript;

    clearTimeout(window.speechTimeout);

    window.speechTimeout = setTimeout(async () => {
      if (finalTranscript.trim() === "") return;

      const pesan = finalTranscript.trim();

      finalTranscript = "";

      // SIMPAN KE HISTORY
      addToHistory("user", pesan);

      recognition.stop();

      isListening = false;

      await prosesBalasan(pesan);
    }, 1200);
  };

  // ===============================
  // AUTO RESTART
  // ===============================
  recognition.onend = () => {
    if (isListening) {
      setTimeout(() => {
        recognition.start();
      }, 500);
    }
  };

  // ===============================
  // ERROR
  // ===============================
  recognition.onerror = (event) => {
    console.log("Speech Error:", event.error);

    const ignoredErrors = ["network", "no-speech", "audio-capture", "aborted"];

    if (ignoredErrors.includes(event.error)) {
      if (isListening) {
        statusText.innerText = "Status: Mendengarkan...";
      }

      recognition.stop();

      setTimeout(() => {
        if (isListening) {
          try {
            recognition.start();
          } catch (e) {}
        }
      }, 800);

      return;
    }

    statusText.innerText = "Mic bermasalah";
  };
}
