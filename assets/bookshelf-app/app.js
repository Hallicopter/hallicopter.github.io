import * as THREE from "../vendor/three/three.module.js";
// Allow overriding a full/absolute URL from the embedding page:
const dataPath = window.BOOKSHELF_JSON_PATH || "../bookshelf/books.json";

// Robust URL helpers so assets resolve no matter where the widget is embedded
const resolveURL = (path, base) => {
  try {
    return new URL(path, base).href;
  } catch {
    return path;
  }
};
const isAbsoluteURL = (value) => /^https?:\/\//i.test(value);
const stripLeadingSlash = (value) => value.replace(/^\/+/, "");
const resolveDataPath = (path) => {
  if (!path) {
    return path;
  }
  if (isAbsoluteURL(path)) {
    return path;
  }
  if (path.startsWith("/")) {
    return `${window.location.origin}${path}`;
  }
  if (path.startsWith("./") || path.startsWith("../")) {
    return resolveURL(path, import.meta.url);
  }
  return `${window.location.origin}/${stripLeadingSlash(path)}`;
};
// Resolve books.json relative to this module file (or the site origin)
const dataURL = resolveDataPath(dataPath);
// Directory that contains books.json - we resolve coverImage against this
const dataDir = dataURL.replace(/[^/]+$/, "");
const resolveAssetPath = (path) => {
  if (!path) {
    return path;
  }
  if (isAbsoluteURL(path)) {
    return path;
  }
  if (path.startsWith("/")) {
    return `${window.location.origin}${path}`;
  }
  return resolveURL(path, dataDir);
};

function roundedRectShape(width, height, radius) {
  const shape = new THREE.Shape();
  const w = width;
  const h = height;
  const r = Math.min(radius, Math.min(w, h) * 0.5);
  shape.moveTo(-w / 2 + r, -h / 2);
  shape.lineTo(w / 2 - r, -h / 2);
  shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  shape.lineTo(w / 2, h / 2 - r);
  shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  shape.lineTo(-w / 2 + r, h / 2);
  shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  shape.lineTo(-w / 2, -h / 2 + r);
  shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return shape;
}

function setSRGB(texture) {
  if (!texture) {
    return texture;
  }
  if ("colorSpace" in texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
  } else {
    texture.encoding = THREE.sRGBEncoding;
  }
  return texture;
}

function prepareCoverTexture(texture) {
  if (!texture) {
    return texture;
  }
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  if (texture.isCanvasTexture) {
    texture.flipY = false;
  } else {
    texture.flipY = true;
  }
  setSRGB(texture);
  texture.needsUpdate = true;
  return texture;
}

const adjustColorLightness = (hex, delta) => {
  try {
    const base = new THREE.Color(hex);
    const hsl = {};
    base.getHSL(hsl);
    hsl.l = THREE.MathUtils.clamp(hsl.l + delta, 0, 1);
    return new THREE.Color().setHSL(hsl.h, hsl.s, hsl.l).getStyle();
  } catch (error) {
    return hex;
  }
};
const container = document.getElementById("bookshelf-canvas");

if (!container) {
  console.warn("Bookshelf canvas container not found.");
} else {
  const detailTitle = document.getElementById("detail-title");
  const detailAuthor = document.getElementById("detail-author");
  const detailSummary = document.getElementById("detail-summary");
  const detailNotes = document.getElementById("detail-notes");
  const detailFound = document.getElementById("detail-found");
  const closeBtn = document.getElementById("detail-close");
  const nextBtn = document.getElementById("detail-next");
  const detailPanel = document.getElementById("detail-panel");

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  if ("outputColorSpace" in renderer) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  } else {
    renderer.outputEncoding = THREE.sRGBEncoding;
  }
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf5e8c9);
  const gridGroup = new THREE.Group();
  scene.add(gridGroup);

  const camera = new THREE.PerspectiveCamera(
    38,
    container.clientWidth / container.clientHeight,
    0.1,
    100,
  );
  camera.position.set(0, 1.9, 8.6);
  camera.lookAt(0, 0, 0);

  const ambient = new THREE.AmbientLight(0xffffff, 0.82);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.18);
  keyLight.position.set(-5, 12, 10);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);

  const fillLight = new THREE.SpotLight(
    0xfef4df,
    0.65,
    60,
    Math.PI / 5.5,
    0.65,
  );
  fillLight.position.set(6, 11, 8);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xf5f2ea, 0.45);
  rimLight.position.set(0, 8, -12);
  scene.add(rimLight);

  const BOOK_WIDTH = 1.42;
  const BOOK_HEIGHT = 2.2;
  const BOOK_DEPTH = 0.24;
  const BOOK_SPACING_Z = 0.08;
  let booksPerRow = 4;
  let columnSpacing = BOOK_WIDTH * 0.45;

  let layoutSpacingY = BOOK_HEIGHT * 1.6;
  let layoutRows = 0;
  let layoutRowOffset = 0;
  let gridWidth = BOOK_WIDTH;
  let gridHeight = BOOK_HEIGHT;
  let viewWidthCache = 0;

  const books = [];
  let selectedBook = null;
  let highlightedBook = null;

  const loader = new THREE.TextureLoader();
  if (loader.setCrossOrigin) {
    loader.setCrossOrigin("anonymous");
  } else {
    loader.crossOrigin = "anonymous";
  }

  class BookMesh {
    constructor(data, index) {
      this.data = data;
      this.index = index;
      this.group = new THREE.Group();
      this.group.castShadow = true;
      this.group.receiveShadow = true;
      this.floatPhase = Math.random() * Math.PI * 2;
      this.floatAmplitude = 0.05 + Math.random() * 0.04;
      this.floatSpeed = 0.5 + Math.random() * 0.6;

      this.basePosition = new THREE.Vector3();
      this.targetPosition = new THREE.Vector3();
      this.focusOffset = new THREE.Vector3(-1.1, 0.18, 0.0);
      this.scaleCurrent = 1;
      this.scaleTarget = 1;
      this.openAmount = 0;
      this.openTarget = 0;

      this.frontGroup = new THREE.Group();

      this.baseRotationY = (Math.random() - 0.5) * 0.18;
      this.currentRotation = new THREE.Euler(0, this.baseRotationY, 0);
      this.targetRotation = new THREE.Euler(0, this.baseRotationY, 0);

      this.buildMeshes();
    }
    async buildMeshes() {
      const WIDTH = 1.42;
      const HEIGHT = 2.18;
      const BOARD_THICKNESS = 0.06;
      const PAGES_THICKNESS = 0.12;
      const JACKET_GAP = 0.002;
      const BOARD_BEVEL = 0.014;

      const accentHex = this.data.accentColor || "#c8a06a";
      const spineHex =
        this.data.spineColor || this.data.accentColor || "#5a4534";

      const boardColor = new THREE.Color(spineHex).convertSRGBToLinear();
      const jacketColor = new THREE.Color(accentHex).convertSRGBToLinear();
      const pageColor = new THREE.Color(0xf3e6cf).convertSRGBToLinear();
      const spineShade = new THREE.Color(spineHex)
        .offsetHSL(0, -0.03, -0.05)
        .convertSRGBToLinear();

      const boardMaterial = new THREE.MeshStandardMaterial({
        color: boardColor,
        roughness: 0.86,
        metalness: 0,
      });
      const pagesMaterial = new THREE.MeshStandardMaterial({
        color: pageColor,
        roughness: 0.96,
        metalness: 0,
      });
      const jacketMaterial = new THREE.MeshStandardMaterial({
        color: jacketColor,
        roughness: 0.52,
        metalness: 0.02,
      });

      const coverShape = roundedRectShape(WIDTH, HEIGHT, 0.08);
      const boardGeometry = new THREE.ExtrudeGeometry(coverShape, {
        depth: BOARD_THICKNESS,
        bevelEnabled: true,
        bevelSize: BOARD_BEVEL,
        bevelThickness: BOARD_BEVEL,
        bevelSegments: 2,
      });
      boardGeometry.translate(0, 0, -BOARD_THICKNESS / 2);

      const pagesGeometry = new THREE.ExtrudeGeometry(
        roundedRectShape(WIDTH * 0.97, HEIGHT * 0.97, 0.06),
        {
          depth: PAGES_THICKNESS,
          bevelEnabled: false,
        },
      );
      pagesGeometry.translate(0, 0, -PAGES_THICKNESS / 2);

      const backBoard = new THREE.Mesh(boardGeometry.clone(), boardMaterial);
      backBoard.castShadow = true;
      backBoard.receiveShadow = true;
      backBoard.position.z = -(PAGES_THICKNESS / 2 + BOARD_THICKNESS / 2);
      backBoard.userData.book = this;
      this.group.add(backBoard);

      const pages = new THREE.Mesh(pagesGeometry, pagesMaterial);
      pages.castShadow = true;
      pages.receiveShadow = true;
      pages.userData.book = this;
      this.group.add(pages);

      const frontHinge = new THREE.Group();
      frontHinge.position.set(
        -WIDTH / 2,
        0,
        PAGES_THICKNESS / 2 + BOARD_THICKNESS / 2,
      );
      this.frontGroup = frontHinge;
      frontHinge.userData.book = this;
      this.group.add(frontHinge);

      const frontCoverGroup = new THREE.Group();
      frontCoverGroup.position.x = WIDTH / 2;
      frontCoverGroup.userData.book = this;
      frontHinge.add(frontCoverGroup);

      const frontCover = new THREE.Mesh(boardGeometry.clone(), jacketMaterial);
      frontCover.castShadow = true;
      frontCover.receiveShadow = true;
      frontCover.userData.book = this;
      frontCoverGroup.add(frontCover);

      const coverPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(WIDTH * 0.96, HEIGHT * 0.96),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          map: null,
          toneMapped: false,
        }),
      );
      coverPlane.position.set(
        0,
        0,
        BOARD_THICKNESS / 2 + BOARD_BEVEL + JACKET_GAP,
      );
      coverPlane.material.side = THREE.DoubleSide;
      coverPlane.userData.book = this;
      coverPlane.renderOrder = 1;
      frontCoverGroup.add(coverPlane);

      const brightenLayer = new THREE.Mesh(
        new THREE.PlaneGeometry(WIDTH * 0.95, HEIGHT * 0.95),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          opacity: 0.12,
          transparent: true,
          toneMapped: false,
        }),
      );
      brightenLayer.position.set(
        0,
        0,
        BOARD_THICKNESS / 2 + BOARD_BEVEL + JACKET_GAP * 1.5,
      );
      brightenLayer.renderOrder = 1.5;
      frontCoverGroup.add(brightenLayer);

      const glossLayer = new THREE.Mesh(
        new THREE.PlaneGeometry(WIDTH * 0.96, HEIGHT * 0.96),
        new THREE.MeshPhysicalMaterial({
          transparent: true,
          opacity: 0.06,
          roughness: 0.22,
          metalness: 0,
          clearcoat: 1,
          clearcoatRoughness: 0.1,
        }),
      );
      glossLayer.position.set(
        0,
        0,
        BOARD_THICKNESS / 2 + BOARD_BEVEL + JACKET_GAP * 2,
      );
      glossLayer.material.depthWrite = false;
      glossLayer.renderOrder = 2;
      glossLayer.userData.book = this;
      frontCoverGroup.add(glossLayer);

      const spine = new THREE.Mesh(
        new THREE.BoxGeometry(
          BOARD_THICKNESS * 0.9,
          HEIGHT * 0.96,
          (BOARD_THICKNESS + PAGES_THICKNESS) * 0.98,
        ),
        new THREE.MeshStandardMaterial({
          color: spineShade,
          roughness: 0.82,
          metalness: 0,
        }),
      );
      spine.position.set(-WIDTH / 2 - BOARD_THICKNESS * 0.45, 0, 0);
      spine.castShadow = true;
      spine.userData.book = this;
      this.group.add(spine);

      const coverTexture = await this.loadCoverTexture();
      if (coverTexture) {
        coverPlane.material.map = coverTexture;
        coverPlane.material.needsUpdate = true;
      }
      const hoverPlate = new THREE.Mesh(
        new THREE.BoxGeometry(BOOK_WIDTH * 1.18, 0.02, BOOK_DEPTH * 1.2),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0,
        }),
      );
      hoverPlate.position.set(0, -BOOK_HEIGHT * 0.55, 0);
      hoverPlate.visible = true;
      hoverPlate.userData.book = this;
      this.group.add(hoverPlate);
      this.hoverPlate = hoverPlate;

      this.group.userData.book = this;
      this.group.rotation.set(0, this.baseRotationY, 0);
      this.currentRotation.set(0, this.baseRotationY, 0);
      this.targetRotation.set(0, this.baseRotationY, 0);
    }
    async loadCoverTexture() {
      const maxAniso = renderer.capabilities.getMaxAnisotropy();
      const placeholder = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 768;
        const ctx = canvas.getContext("2d");
        const baseColor = this.data.accentColor || "#8b5a2b";
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, adjustColorLightness(baseColor, 0.18));
        gradient.addColorStop(1, adjustColorLightness(baseColor, -0.05));
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgba(255, 240, 215, 0.9)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = 'bold 42px "IM Fell DW Pica", serif';
        wrapText(
          ctx,
          this.data.title || "Untitled",
          canvas.width / 2,
          canvas.height / 2,
          canvas.width - 160,
          54,
        );
        ctx.font = '28px "IM Fell DW Pica", serif';
        ctx.fillText(
          this.data.author || "",
          canvas.width / 2,
          canvas.height * 0.8,
        );
        const texture = new THREE.CanvasTexture(canvas);
        texture.anisotropy = maxAniso;
        return prepareCoverTexture(texture);
      };

      if (!this.data.coverImage) {
        return placeholder();
      }

      return new Promise((resolve) => {
        loader.load(
          this.data.coverImage,
          (texture) => {
            texture.anisotropy = maxAniso;
            resolve(prepareCoverTexture(texture));
          },
          undefined,
          () => resolve(placeholder()),
        );
      });
    }

    placeOnGrid(rowIndex, columnIndex, columnsInRow) {
      const columns = Math.max(1, columnsInRow || booksPerRow);
      const step = BOOK_WIDTH + columnSpacing;
      const centerOffset = (columns - 1) * step * 0.5;
      const x = columnIndex * step - centerOffset;
      const y = layoutRowOffset - rowIndex * layoutSpacingY;
      const z = Math.sin(columnIndex * 0.25) * BOOK_SPACING_Z;
      this.basePosition.set(x, y, z);
      if (!this.isFocused()) {
        this.targetPosition.copy(this.basePosition);
        this.group.position.copy(this.basePosition);
      }
      this.group.rotation.set(0, this.baseRotationY, 0);
      this.currentRotation.set(0, this.baseRotationY, 0);
      this.targetRotation.set(0, this.baseRotationY, 0);
    }

    setHighlighted(isHighlighted) {
      if (isHighlighted && !this.isFocused()) {
        this.scaleTarget = 1.06;
        this.targetRotation.y = this.baseRotationY + 0.1;
      } else if (!this.isFocused()) {
        this.scaleTarget = 1;
        this.targetRotation.y = this.baseRotationY;
      }
    }

    setFocused(isFocused) {
      if (isFocused) {
        // Natural "peek open", keep the book near its grid position
        this.openTarget = 0.28; // subtle opening
        this.scaleTarget = 1.04; // gentle emphasis
        this.targetRotation.y = 0; // face the camera
        this.targetPosition.copy(this.basePosition).add(this.focusOffset);
      } else {
        this.openTarget = 0;
        this.scaleTarget = 1;
        this.targetRotation.y = this.baseRotationY;
        this.targetPosition.copy(this.basePosition);
      }
    }

    isFocused() {
      return this.openTarget > 0.1 || this.openAmount > 0.1;
    }

    setVisible(show) {
      this.group.visible = show;
      if (this.hoverPlate) {
        this.hoverPlate.visible = show;
      }
      if (this.frontGroup) {
        this.frontGroup.visible = show;
      }
      if (!show) {
        this.openTarget = 0;
      }
    }

    resetToGrid() {
      this.openTarget = 0;
      this.openAmount = 0;
      this.scaleTarget = 1;
      this.group.visible = true;
      this.targetRotation.y = this.baseRotationY;
      this.targetPosition.copy(this.basePosition);
      this.group.position.copy(this.basePosition);
      this.group.scale.setScalar(1);
      this.currentRotation.set(0, this.baseRotationY, 0);
      this.group.rotation.set(0, this.baseRotationY, 0);
      if (this.frontGroup) {
        this.frontGroup.visible = true;
        this.frontGroup.rotation.y = 0;
      }
    }

    update(delta) {
      this.floatPhase += delta * this.floatSpeed;
      const floatOffset = Math.sin(this.floatPhase) * this.floatAmplitude;
      const newY = THREE.MathUtils.lerp(
        this.group.position.y,
        this.targetPosition.y + floatOffset,
        0.12,
      );
      const newX = THREE.MathUtils.lerp(
        this.group.position.x,
        this.targetPosition.x,
        0.12,
      );
      const newZ = THREE.MathUtils.lerp(
        this.group.position.z,
        this.targetPosition.z,
        0.12,
      );
      this.group.position.set(newX, newY, newZ);

      this.currentRotation.x = THREE.MathUtils.lerp(
        this.currentRotation.x,
        this.targetRotation.x || 0,
        0.12,
      );
      this.currentRotation.y = THREE.MathUtils.lerp(
        this.currentRotation.y,
        this.targetRotation.y,
        0.12,
      );
      this.currentRotation.z = THREE.MathUtils.lerp(
        this.currentRotation.z,
        this.targetRotation.z || 0,
        0.12,
      );
      this.group.rotation.set(
        this.currentRotation.x,
        this.currentRotation.y,
        this.currentRotation.z,
      );

      this.scaleCurrent = THREE.MathUtils.lerp(
        this.scaleCurrent,
        this.scaleTarget,
        0.1,
      );
      this.group.scale.setScalar(this.scaleCurrent);

      this.openAmount = THREE.MathUtils.lerp(
        this.openAmount,
        this.openTarget,
        0.15,
      );
      this.frontGroup.rotation.y = -this.openAmount;
    }
  }

  const clock = new THREE.Clock();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const cameraBasePosition = new THREE.Vector3(0, 1.9, 8.6);
  const cameraBaseLookAt = new THREE.Vector3(0, 0, 0);
  let cameraTargetPosition = cameraBasePosition.clone();
  let cameraTargetLookAt = cameraBaseLookAt.clone();
  const cameraLookAt = cameraBaseLookAt.clone();

  function viewWidthAtBase() {
    const aspect =
      container.clientWidth && container.clientHeight
        ? container.clientWidth / container.clientHeight
        : camera.aspect;
    const distance = cameraBasePosition.distanceTo(cameraBaseLookAt);
    return (
      2 *
      Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) *
      distance *
      aspect
    );
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    if (!text) {
      return;
    }
    const words = text.split(" ");
    const lines = [];
    let current = "";
    words.forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    });
    if (current) {
      lines.push(current);
    }
    const total = (lines.length - 1) * lineHeight;
    let cursor = y - total / 2;
    lines.forEach((line) => {
      ctx.fillText(line, x, cursor);
      cursor += lineHeight;
    });
  }

  function updateGridMetrics(count) {
    if (!count) {
      return;
    }
    const aspect =
      container.clientWidth && container.clientHeight
        ? container.clientWidth / container.clientHeight
        : camera.aspect || 1.6;

    const idealCols = Math.ceil(Math.sqrt(count * Math.min(aspect, 1.4)));
    const minCols = Math.min(3, count);
    const maxCols = Math.min(5, count);
    booksPerRow = THREE.MathUtils.clamp(idealCols, minCols || 1, maxCols || count);

    const horizontalTightness = THREE.MathUtils.clamp(
      0.58,
      0.32,
      0.6,
    );
    columnSpacing = BOOK_WIDTH * horizontalTightness;

    layoutRows = Math.max(1, Math.ceil(count / booksPerRow));
    const verticalTightness =
      layoutRows <= 3
        ? 1.35
        : layoutRows <= 6
          ? 1.2
          : 1.05;
    layoutSpacingY = BOOK_HEIGHT * verticalTightness;
    layoutRowOffset = (layoutRows - 1) * layoutSpacingY * 0.5;

    const stepX = BOOK_WIDTH + columnSpacing;
    gridWidth = booksPerRow * BOOK_WIDTH + (booksPerRow - 1) * columnSpacing;
    gridHeight =
      layoutRows <= 1
        ? BOOK_HEIGHT
        : layoutRows * BOOK_HEIGHT + (layoutRows - 1) * (layoutSpacingY - BOOK_HEIGHT);

    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const viewportAspect = container.clientWidth && container.clientHeight
      ? container.clientWidth / container.clientHeight
      : 1.6;
    const halfHeight = gridHeight * 0.5 + BOOK_HEIGHT * 0.95;
    const distanceForHeight = halfHeight / Math.tan(verticalFov / 2);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * viewportAspect);
    const halfWidth = gridWidth * 0.5 + BOOK_WIDTH * 1.05;
    const distanceForWidth = halfWidth / Math.tan(horizontalFov / 2);
    const requiredDist = Math.max(distanceForHeight, distanceForWidth, 6.5);

    const verticalOffset = 1.9 + Math.max(0, layoutRows - 3) * 0.22;
    cameraBasePosition.set(0, verticalOffset, requiredDist);
    cameraBaseLookAt.set(0, 0, 0);
    if (!selectedBook) {
      camera.position.copy(cameraBasePosition);
      cameraTargetPosition = cameraBasePosition.clone();
      cameraTargetLookAt = cameraBaseLookAt.clone();
      cameraLookAt.copy(cameraBaseLookAt);
    }

    viewWidthCache = viewWidthAtBase();
  }

  function distributeBooks(data) {
    updateGridMetrics(data.length);

    data.forEach((bookData, index) => {
      const row = Math.floor(index / booksPerRow);
      const col = index % booksPerRow;
      const columnsInThisRow = Math.min(
        booksPerRow,
        data.length - row * booksPerRow,
      );
      const book = new BookMesh(bookData, index);
      book.placeOnGrid(row, col, columnsInThisRow);
      gridGroup.add(book.group);
      books.push(book);
    });

    relayoutBooks();
  }

  function relayoutBooks() {
    if (!books.length) {
      return;
    }
    updateGridMetrics(books.length);

    books.forEach((book, index) => {
      const row = Math.floor(index / booksPerRow);
      const col = index % booksPerRow;
      const columnsInThisRow = Math.min(
        booksPerRow,
        books.length - row * booksPerRow,
      );
      book.placeOnGrid(row, col, columnsInThisRow);
      if (!book.isFocused()) {
        if (!selectedBook) {
          book.resetToGrid();
        } else if (!book.group.visible) {
          book.targetPosition.copy(book.basePosition);
        } else {
          book.targetPosition.copy(book.basePosition);
          book.group.position.copy(book.basePosition);
          book.group.rotation.set(0, book.baseRotationY, 0);
        }
      }
    });
  }

  function updateDetail(book) {
    if (!book) {
      detailTitle.textContent = "";
      detailAuthor.textContent = "";
      detailSummary.textContent = "";
      detailNotes.textContent = "";
      detailFound.textContent = "";
      return;
    }
    detailTitle.textContent = book.data.title || "Untitled";
    detailAuthor.textContent = book.data.author || "";
    detailSummary.textContent = book.data.summary || "";
    detailNotes.textContent = book.data.notes || "";
    detailFound.textContent = book.data.found || "";
  }

  function focusBook(book) {
    selectedBook = book;
    books.forEach((item) => {
      const isSelected = item === selectedBook;
      if (selectedBook) {
        item.setVisible(isSelected);
      } else {
        item.setVisible(true);
        item.resetToGrid();
      }
      item.setFocused(isSelected);
      if (!selectedBook) {
        item.setHighlighted(false);
      }
    });

    if (selectedBook) {
      updateDetail(selectedBook);
      if (detailPanel) {
        detailPanel.classList.remove("detail-empty");
      }
      highlightedBook = selectedBook;
      const worldPos = new THREE.Vector3();
      selectedBook.group.getWorldPosition(worldPos);
      cameraTargetPosition = worldPos
        .clone()
        .add(new THREE.Vector3(-2.8, 0.32, 5.2));
      cameraTargetLookAt = worldPos.clone().add(new THREE.Vector3(1.6, 0, 0));
      if (detailPanel) {
        detailPanel.classList.remove("detail-empty");
      }
    } else {
      updateDetail(null);
      if (detailPanel) {
        detailPanel.classList.add("detail-empty");
      }
      highlightedBook = null;
      cameraTargetPosition = cameraBasePosition.clone();
      cameraTargetLookAt = cameraBaseLookAt.clone();
      renderer.domElement.style.cursor = "auto";
      relayoutBooks();
    }
  }

  function nextBook() {
    if (!books.length) {
      return;
    }
    if (!selectedBook) {
      focusBook(books[0]);
      return;
    }
    const nextIndex = (selectedBook.index + 1) % books.length;
    focusBook(books[nextIndex]);
  }

  function pointerMove(event) {
    if (selectedBook) {
      renderer.domElement.style.cursor = "auto";
      return;
    }
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    const firstHit = intersects.find((hit) => hit.object.userData.book);
    if (firstHit) {
      const book = firstHit.object.userData.book;
      if (highlightedBook && highlightedBook !== book) {
        highlightedBook.setHighlighted(false);
      }
      highlightedBook = book;
      highlightedBook.setHighlighted(true);
      renderer.domElement.style.cursor = "pointer";
    } else if (highlightedBook) {
      highlightedBook.setHighlighted(false);
      highlightedBook = null;
      renderer.domElement.style.cursor = "auto";
    }
  }

  function pointerClick(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    const firstHit = intersects.find((hit) => hit.object.userData.book);
    if (firstHit) {
      const book = firstHit.object.userData.book;
      focusBook(book === selectedBook ? null : book);
    }
  }

  function render() {
    const delta = clock.getDelta();
    books.forEach((book) => book.update(delta));
    camera.position.lerp(cameraTargetPosition, 0.08);
    cameraLookAt.lerp(cameraTargetLookAt, 0.1);
    camera.lookAt(cameraLookAt);
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }

  async function init() {
    try {
      const response = await fetch(dataURL, { cache: "no-cache" });
      if (!response.ok) {
        throw new Error("Unable to load bookshelf data");
      }
      const payload = await response.json();
      const items = Array.isArray(payload) ? payload : payload.books;
      if (!Array.isArray(items) || !items.length) {
        throw new Error("bookshelf data should include at least one entry");
      }
      // Resolve per-book assets relative to the JSON file's folder:
      const normalized = items.map((b) => ({
        ...b,
        coverImage: b.coverImage ? resolveAssetPath(b.coverImage) : null,
      }));
      distributeBooks(normalized);
      updateDetail(null);
      if (detailPanel) {
        detailPanel.classList.add("detail-empty");
      }
    } catch (error) {
      console.error(error);
      updateDetail(null);
      if (detailPanel) {
        detailPanel.classList.add("detail-empty");
      }
      detailSummary.textContent = "Unable to load the bookshelf right now.";
    }
    render();
  }

  function onResize() {
    const { clientWidth, clientHeight } = container;
    renderer.setSize(clientWidth, clientHeight);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    relayoutBooks();
  }

  renderer.domElement.addEventListener("pointermove", pointerMove, {
    passive: true,
  });
  renderer.domElement.addEventListener("click", pointerClick);
  window.addEventListener("resize", onResize);

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      focusBook(null);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", nextBook);
  }

  init();
}
