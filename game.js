import { variantStructure, loadVariant, reviewLayout } from './world-art/house-variant-runtime.mjs';
import { prepareHouseRuntime } from './world-art/house-runtime-alpha.mjs?v=2';
import { structureAnchor, structureBounds, actorHeight, viewportSize, placementClear, wallFace } from './world-art/live-world-spatial.mjs';
// SURROUND ME — The Verge (Area 1)
// An isometric dark fantasy action RPG that asks whether the player can remain present
// ============================================================
// GAME STATE MACHINE
// ============================================================
const GameState = {
    TITLE: 'title',
    CONTROLS: 'controls',
    LOADING: 'loading',
    HUB: 'hub',         // The Holdfast — safe area, NPCs, inventory
    EXPLORING: 'exploring', // The Verge — enemies, danger
};
let gameState = GameState.TITLE;
let stateTransitionTimer = 0;

// configuration for audio tweaks, persisted to localStorage (JSON)
const audioConfig = {
    hubMelodyVolume: 1.0,
    hubBassVolume: 1.0,
    subBassVolume: 1.0,
    pitchWarpStrength: 1.0,
    pitchFactor: 1.0,
    bassWarpStrength: 1.0,
    neutralHarmony: 1.0,
    tempoFactor: 1.0,
    titleVolume: 1.0,
};
function saveAudioConfig() {
    try { localStorage.setItem('audioConfig', JSON.stringify(audioConfig)); }
    catch(e) { console.warn('save config failed', e); }
}
function loadAudioConfig() {
    try {
        const s = localStorage.getItem('audioConfig');
        if (s) Object.assign(audioConfig, JSON.parse(s));
    } catch(e){ console.warn('load config failed', e); }
        // ensure neutralBpm exists
        if (!audioConfig.neutralBpm) audioConfig.neutralBpm = 100;
}
loadAudioConfig();
// clamp to valid ranges
audioConfig.tempoFactor = audioConfig.tempoFactor || 1.0;

// Demo mode used on title screen: force greyline to neutral/compulsion/restraint
let demoMode = null;
let demoTimer = 0;
let demoOriginalG = 0;
function startTitleDemo(side) {
    // remember previous value to restore
    demoOriginalG = greyline?.g ?? 0;
    demoMode = side;
    demoTimer = 8.0;
    if (side === 'neutral') greyline.g = 0;
    else if (side === 'compulsion') greyline.g = 1;
    else if (side === 'restraint') greyline.g = -1;
    hubMelTimer = hubBassTimer = hubPadTimer = 0;
}

// Hub safety radius — enemies cannot enter or attack within this range
const HUB_SAFE_RADIUS = 16;

// Gate — the exit from the Holdfast into the Verge
const HUB_GATE_ANGLE = Math.PI * 0.75; // southeast
const HUB_GATE_WIDTH = 0.35; // radians width of opening

// Track whether player has ever exited the hub (enemies don't exist until first exit)
let hasExitedHub = false;
let enemiesSpawned = false;

// ============================================================
// ASSET URLS
// ============================================================
const ASSETS = {
    aliza: 'https://rosebud.ai/assets/aliza-definitive-final.webp?HLrg',
    // 8-directional Aliza sprites (S, N, E, SE, NE — W/SW/NW are mirrored)
    alizaSouth: 'https://rosebud.ai/assets/aliza-south.webp?XlR7',
    alizaNorth: 'https://rosebud.ai/assets/aliza-north.webp?ID6e',
    alizaEast: 'https://rosebud.ai/assets/aliza-east.webp?E3hf',
    alizaSoutheast: 'https://rosebud.ai/assets/aliza-southeast.webp?pEXM',
    alizaNortheast: 'https://rosebud.ai/assets/aliza-northeast.webp?XPJC',

    // Local Aliza test sprites (user-provided, prefer these when present)
    Aliza1: './Aliza1.png',        Aliza1gun: './Aliza1gun.png',        Aliza1knife: './Aliza1knife.png',
    Aliza2: './Aliza2.png',        Aliza2gun: './Aliza2gun.png',        Aliza2knife: './Aliza2knife.png',
    Aliza3: './Aliza3.png',        Aliza3gun: './Aliza3gun.png',        Aliza3knife: './Aliza3knife.png',
    Aliza4: './Aliza4.png',        Aliza4gun: './Aliza4gun.png',        Aliza4knife: './Aliza4knife.png',
    Aliza5: './Aliza5.png',        Aliza5gun: './Aliza5gun.png',        Aliza5knife: './Aliza5knife.png',
    Aliza6: './Aliza6.png',        Aliza6gun: './Aliza6gun.png',        Aliza6knife: './Aliza6knife.png',
    Aliza7: './Aliza7.png',        Aliza7gun: './Aliza7gun.png',        Aliza7knife: './Aliza7knife.png',
    Aliza8: './Aliza8.png',        Aliza8gun: './Aliza8gun.png',        Aliza8knife: './Aliza8knife.png',

    // Enemy sprites
    lingering: 'https://rosebud.ai/assets/enemy-lingering.webp?QL8s',
    watchful: 'https://rosebud.ai/assets/enemy-watchful.webp?Hzeb',
    huddled: 'https://rosebud.ai/assets/enemy-huddled.webp?lfyK',
    rehearsed: 'https://rosebud.ai/assets/enemy-rehearsed.webp?ltUV',
    burdened: 'https://rosebud.ai/assets/enemy-burdened.webp?CBXl',
    drifting: 'https://rosebud.ai/assets/enemy-drifting.webp?Enqw',
    deferred: 'https://rosebud.ai/assets/enemy-deferred.webp?Dab1',
    remembered: 'https://rosebud.ai/assets/enemy-remembered.webp?bIeU',
    // Ground textures
    groundDirt: 'https://rosebud.ai/assets/ground-dirt-tile.webp?JQ74',
    groundHub: 'https://rosebud.ai/assets/ground-hub-tile.webp?2ABi',
    // Local road/asphalt/concrete tiles (used by procedural mapping)
    groundAsphalt: './asphalt1.png',
    groundConcrete: './concrete.png',
    groundRoad: './road1.png',
    // Hub house variants (randomized per shack)
    house1: './house1.png',
    house2: './house2.png',
    house3: './house3.png',
    // G1.8 governed House A master, 2048 physical / 512 logical canvas.
    houseAG18Governed: './world-art/hd-iso-v1/runtime/house-master-a-g1-8-governed-2048.png',
    // Environment assets
    deadTree1: 'https://rosebud.ai/assets/dead-tree.webp?1SVp',
    deadTree2: 'https://rosebud.ai/assets/dead-tree-2.webp?eqpz',
    brokenFence: 'https://rosebud.ai/assets/broken-fence.webp?VCW9',
    collapsedBarn: 'https://rosebud.ai/assets/collapsed-barn.webp?Mb0e',
    stoneRuin: 'https://rosebud.ai/assets/stone-ruin.webp?TA0p',
    groundRocks: 'https://rosebud.ai/assets/ground-rocks.webp?ykPA',
    hubChapel: 'https://rosebud.ai/assets/hub-chapel.webp?eun8',
    hubDwelling: 'https://rosebud.ai/assets/hub-dwelling.webp?ke9K',
    // New environment props
    oldWell: 'https://rosebud.ai/assets/old-well.webp?QTO9',
    woodenCart: 'https://rosebud.ai/assets/wooden-cart.webp?hBdU',
    graveMarkers: 'https://rosebud.ai/assets/grave-markers.webp?CVtS',
    deadBush: 'https://rosebud.ai/assets/dead-bush.webp?VrFf',
    oldSignpost: 'https://rosebud.ai/assets/old-signpost.webp?CN3F',
    hayPile: 'https://rosebud.ai/assets/hay-pile.webp?qyDp',
    skullPile: 'https://rosebud.ai/assets/skull-pile.webp?g1kK',
    lanternPost: 'https://rosebud.ai/assets/lantern-post.webp?VSnV',
    // NPC sprites
    npcKeeper: 'https://rosebud.ai/assets/npc-keeper.webp?Skdd',
    npcSable: 'https://rosebud.ai/assets/npc-sable.webp?xgd1',
    npcOren: 'https://rosebud.ai/assets/npc-oren.webp?uShU',
    npcHarren: 'https://rosebud.ai/assets/npc-harren.webp?SFHF',
    // Item icons
    itemRapier: 'https://rosebud.ai/assets/item-rapier.webp?3bbW',
    itemAmulet: 'https://rosebud.ai/assets/item-amulet.webp?m58G',
    itemGlasses: 'https://rosebud.ai/assets/item-glasses.webp?eVZG',
    itemTrenchcoat: 'https://rosebud.ai/assets/item-trenchcoat.webp?opt8',
    // UI
    uiFrame: 'https://rosebud.ai/assets/ui-frame.webp?KGY1',
    uiHealthOrb: 'https://rosebud.ai/assets/ui-health-orb.webp?z3U4',
    uiStaminaOrb: 'https://rosebud.ai/assets/ui-stamina-orb.webp?NDl9',
    uiBurdenOrb: 'https://rosebud.ai/assets/ui-burden-orb.webp?zIN3',
    uiGreylineBar: 'https://rosebud.ai/assets/ui-greyline-bar.webp?Mt58',
    uiSkillFrame: 'https://rosebud.ai/assets/ui-skill-frame.webp?yZd2',
    uiXpBar: 'https://rosebud.ai/assets/ui-xp-bar.webp?PIOt',
    // Skill icons
    skillPredatory: 'https://rosebud.ai/assets/skill-predatory.webp?xQmQ',
    skillSnare: 'https://rosebud.ai/assets/skill-snare.webp?CYLW',
    skillReclaim: 'https://rosebud.ai/assets/skill-reclaim.webp?h5Hj',
    skillAttune: 'https://rosebud.ai/assets/skill-attune.webp?bjgs',
    skillBurden: 'https://rosebud.ai/assets/skill-burden.webp?AIOM',
    skillShadow: 'https://rosebud.ai/assets/skill-shadow.webp?DPvM',
    // New item icons — weapons
    itemSerratedBlade: 'https://rosebud.ai/assets/item-serrated-blade.webp?JmG6',
    itemThornedWhip: 'https://rosebud.ai/assets/item-thorned-whip.webp?beOQ',
    itemHollowNeedle: 'https://rosebud.ai/assets/item-hollow-needle.webp?vfLk',
    itemWeightedChain: 'https://rosebud.ai/assets/item-weighted-chain.webp?U0aj',
    // New item icons — armor
    itemAshenMantle: 'https://rosebud.ai/assets/item-ashen-mantle.webp?z60b',
    itemFlayedVest: 'https://rosebud.ai/assets/item-flayed-vest.webp?5jwZ',
    itemIronweaveCoat: 'https://rosebud.ai/assets/item-ironweave-coat.webp?feSs',
    itemCarapacePlate: 'https://rosebud.ai/assets/item-carapace-plate.webp?q8Sq',
    // New item icons — accessories
    itemEchoRing: 'https://rosebud.ai/assets/item-echo-ring.webp?NbtT',
    itemMarrowPendant: 'https://rosebud.ai/assets/item-marrow-pendant.webp?zBsP',
    itemGriefLocket: 'https://rosebud.ai/assets/item-grief-locket.webp?WcT0',
    itemWardenSigil: 'https://rosebud.ai/assets/item-warden-sigil.webp?cQig',
    itemSpiteTooth: 'https://rosebud.ai/assets/item-spite-tooth.webp?dkNQ',
    itemMirrorShard: 'https://rosebud.ai/assets/item-mirror-shard.webp?FI99',
    itemHollowEye: 'https://rosebud.ai/assets/item-hollow-eye.webp?y5UF',
    itemBindingCord: 'https://rosebud.ai/assets/item-binding-cord.webp?uwbX',
    // New item icons — remnants
    itemAshenJournal: 'https://rosebud.ai/assets/item-ashen-journal.webp?O1XG',
    itemHuskFragment: 'https://rosebud.ai/assets/item-husk-fragment.webp?YOlv',
    itemFadedPhoto: 'https://rosebud.ai/assets/item-faded-photo.webp?iIPm',
    itemCorrodedCompass: 'https://rosebud.ai/assets/item-corroded-compass.webp?28Ez',
    // Gold coin
    iconGoldCoin: 'https://rosebud.ai/assets/icon-gold-coin.webp?ycdJ',
};

// 8-direction sprite map: dir index → { image key, flip }
// Dir: 0=N, 1=NE, 2=E, 3=SE, 4=S, 5=SW, 6=W, 7=NW
const ALIZA_DIR_SPRITES = [
    { key: 'alizaNorth',     flip: false },  // 0: N
    { key: 'alizaNortheast', flip: false },  // 1: NE
    { key: 'alizaEast',      flip: false },  // 2: E
    { key: 'alizaSoutheast', flip: false },  // 3: SE
    { key: 'alizaSouth',     flip: false },  // 4: S
    { key: 'alizaSoutheast', flip: true  },  // 5: SW (mirror SE)
    { key: 'alizaEast',      flip: true  },  // 6: W  (mirror E)
    { key: 'alizaNortheast', flip: true  },  // 7: NW (mirror NE)
];

const TEST_ALIZA_SPRITES = true;

// User-provided ordering: Aliza1 = DOWN (S), Aliza2 = DOWN-LEFT (SW), Aliza3 = LEFT (W),
// Aliza4 = TOP-LEFT (NW), Aliza5 = TOP (N), Aliza6 = TOP-RIGHT (NE), Aliza7 = RIGHT (E), Aliza8 = DOWN-RIGHT (SE)
const ALIZA_CUSTOM_BASE = ['Aliza1','Aliza2','Aliza3','Aliza4','Aliza5','Aliza6','Aliza7','Aliza8'];
const ALIZA_CUSTOM_GUN  = ['Aliza1gun','Aliza2gun','Aliza3gun','Aliza4gun','Aliza5gun','Aliza6gun','Aliza7gun','Aliza8gun'];
const ALIZA_CUSTOM_KNIFE= ['Aliza1knife','Aliza2knife','Aliza3knife','Aliza4knife','Aliza5knife','Aliza6knife','Aliza7knife','Aliza8knife'];
// Optional crouch/hide frames (if you provided Aliza1crouch..Aliza8crouch)
const ALIZA_CUSTOM_CROUCH= ['Aliza1crouch','Aliza2crouch','Aliza3crouch','Aliza4crouch','Aliza5crouch','Aliza6crouch','Aliza7crouch','Aliza8crouch'];
// Map DIR8 index -> ALIZA_CUSTOM_* index (user ordering starts at S)
const DIR_TO_CUSTOM_INDEX = [4, 3, 2, 1, 0, 7, 6, 5]; // swapped L/R pairs: NE↔NW, E↔W, SE↔SW


// Pre-created tile pattern canvases for textured ground rendering
let groundDirtPattern = null;
let groundHubPattern = null;
let groundAsphaltPattern = null;
let groundConcretePattern = null;
let groundRoadPattern = null;
let tilePatternCanvas = null;

function createTilePatterns() {
    // Create a clipped diamond pattern from the ground textures
    const dirtImg = loadedImages.groundDirt;
    const hubImg = loadedImages.groundHub;
    const asphaltImg = loadedImages.groundAsphalt;
    const concreteImg = loadedImages.groundConcrete;
    const roadImg = loadedImages.groundRoad;
    
    function makeTileCanvas(img) {
        const tc = document.createElement('canvas');
        tc.width = TILE_W + 4;
        tc.height = TILE_H + 4;
        const tctx = tc.getContext('2d');
        // Clip to diamond — slightly oversized to prevent zoom seams
        tctx.beginPath();
        tctx.moveTo(tc.width / 2, 0);
        tctx.lineTo(tc.width, tc.height / 2);
        tctx.lineTo(tc.width / 2, tc.height);
        tctx.lineTo(0, tc.height / 2);
        tctx.closePath();
        tctx.clip();
        tctx.drawImage(img, 0, 0, tc.width, tc.height);
        return tc;
    }

    if (dirtImg) groundDirtPattern = makeTileCanvas(dirtImg);
    if (hubImg) groundHubPattern = makeTileCanvas(hubImg);
    if (asphaltImg) groundAsphaltPattern = makeTileCanvas(asphaltImg);
    if (concreteImg) groundConcretePattern = makeTileCanvas(concreteImg);
    if (roadImg) groundRoadPattern = makeTileCanvas(roadImg);
}

const loadedImages = {};
let imagesLoaded = 0;
let totalImages = Object.keys(ASSETS).length; // may grow when adding custom assets

function loadImages() {
    // Augment ASSETS with any local custom sprites when testing
    if (TEST_ALIZA_SPRITES) {
        for (const arr of [ALIZA_CUSTOM_BASE, ALIZA_CUSTOM_GUN, ALIZA_CUSTOM_KNIFE, ALIZA_CUSTOM_CROUCH]) {
            for (const key of arr) {
                if (!ASSETS[key]) {
                    ASSETS[key] = `./${key}.png`;
                }
            }
        }
        // re-evaluate totalImages after potential additions
        totalImages = Object.keys(ASSETS).length;
    }
    return new Promise((resolve) => {
        for (const [key, url] of Object.entries(ASSETS)) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                try {
                    loadedImages[key] = key === 'houseAG18Governed'
                        ? prepareHouseRuntime(img, document) : img;
                } catch (error) {
                    loadedImages[key] = null;
                    console.error('House runtime image preparation failed', error);
                }
                imagesLoaded++;
                if (imagesLoaded >= totalImages) resolve();
            };
            img.onerror = () => {
                loadedImages[key] = null;
                imagesLoaded++;
                if (imagesLoaded >= totalImages) resolve();
            };
            img.src = url;
        }
    });
}

// ============================================================
// TITLE SCREEN — Atmospheric canvas background
// ============================================================
function initTitleScreen() {
    // intentionally empty: no canvas effects on title screen per spec
    return;
}

// ============================================================
// AUDIO ENGINE — Pure Web Audio API (no library dependency)
// Diablo 2-inspired: layered ambient music that shifts between
// hub safety (Tristram guitar warmth) and Verge dread.
// ============================================================
let audioEngine = null;
// Sub-bass timing/state (globals used by audio update loop)
let _subBeatTimer = 0;
let _subLastPulse = 0;
let audioStarted = false;
let titleMusicEngine = null;
let _actx = null; // Shared AudioContext
let _audioUnlocked = false;

// ── AUDIO SETTINGS — Adjustable via ESC menu ──
const audioSettings = {
    enabled: true,            // must be true for shot SFX
    master: 0.9,
    music: 0.9,
    sfx: 0.8,
    ambient: 0.55, // make ambience/music always present
};

function getAudioCtx() {
    if (!_actx) {
        _actx = new (window.AudioContext || window.webkitAudioContext)();
        console.log('[Audio] AudioContext created, state:', _actx.state);
    }
    if (_actx.state === 'suspended') {
        _actx.resume().then(() => {
            console.log('[Audio] AudioContext resumed successfully');
            _audioUnlocked = true;
        }).catch(e => console.warn('[Audio] Resume failed:', e));
    } else {
        _audioUnlocked = true;
    }
    return _actx;
}

// Chrome requires a user gesture to unlock AudioContext.
// Add aggressive listeners on EVERY interaction type.
function ensureAudioUnlocked() {
    return new Promise((resolve) => {
        if (_audioUnlocked && _actx && _actx.state === 'running') return resolve(true);
        const ctx = getAudioCtx();
        const finalize = () => {
            try {
                const silentBuf = ctx.createBuffer(1, 1, ctx.sampleRate);
                const src = ctx.createBufferSource();
                src.buffer = silentBuf;
                src.connect(ctx.destination);
                src.start(0);
            } catch (e) {}
            _audioUnlocked = true;
            resolve(true);
        };
        if (ctx.state === 'suspended') {
            ctx.resume().then(() => {
                console.log('[Audio] Unlocked via gesture');
                finalize();
            }).catch((e) => { console.warn('[Audio] resume failed', e); resolve(false); });
        } else {
            finalize();
        }
    });
}

// Attach unlock to every possible user gesture
['click', 'touchstart', 'touchend', 'mousedown', 'keydown', 'pointerdown'].forEach(evt => {
    document.addEventListener(evt, ensureAudioUnlocked, { once: false, passive: true });
});

// UI debug overlay element (created lazily)
function updateUiDebugOverlay() {
    try {
        let el = document.getElementById('ui-debug');
        if (!el) {
            el = document.createElement('div'); el.id = 'ui-debug';
            el.style.position = 'fixed'; el.style.left = '10px'; el.style.top = '10px'; el.style.zIndex = 2000;
            el.style.padding = '8px 10px'; el.style.background = 'rgba(0,0,0,0.6)'; el.style.color = '#ddd';
            el.style.fontSize = '12px'; el.style.fontFamily = 'monospace'; el.style.borderRadius = '6px'; el.style.pointerEvents = 'none';
            document.body.appendChild(el);
        }
        const dims = getViewportDims();
        const vc = window._visibleCanvas || {};
        const displayScale = Math.max(dims.w / FIXED_CANVAS_W, dims.h / FIXED_CANVAS_H);
        const visibleCanvasH = Math.round(dims.h / displayScale);
        const visibleTop = Math.round((FIXED_CANVAS_H - visibleCanvasH) / 2);
        const skillBarY = visibleTop + Math.round((FIXED_CANVAS_H - Math.round(76 * Math.max(0.85, Math.min(2, Math.min(FIXED_CANVAS_W / 1920, FIXED_CANVAS_H / 1080))))) );
        el.innerText = `viewport=${dims.w}x${dims.h}\ncanvas=${FIXED_CANVAS_W}x${FIXED_CANVAS_H} (scale=${vc.scale?.toFixed(2)||displayScale.toFixed(2)})\nvisibleTop=${vc.visibleTop} visibleBottom=${vc.visibleBottom}\nskillBarY(internal)=${skillBarY}`;
        if (audioEngine) {
            try {
                el.innerText += `\nsfxGain=${audioEngine.sfxBus?.gain.value.toFixed(2)} gunGain=${audioEngine.gunBus?.gain.value.toFixed(2)}`;
            } catch(e) {}
        }
        if (window.__FORCE_VIEWPORT) el.style.display = 'block'; else el.style.display = 'none';
    } catch (e) { /* ignore */ }
}

function createGain(ctx, vol) {
    const g = ctx.createGain();
    g.gain.value = (typeof vol === 'number') ? vol : 1.0;
    return g;
}

function createOsc(ctx, type, freq, dest) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.connect(dest);
    o.start();
    return o;
}
function createNoise(ctx, dest) {
    const bufSize = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(dest);
    src.start();
    return src;
}
function createBrownNoise(ctx, dest) {
    const bufSize = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufSize; i++) {
        const w = Math.random() * 2 - 1;
        data[i] = (last + 0.02 * w) / 1.02;
        last = data[i];
        data[i] *= 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(dest);
    src.start();
    return src;
}
function playNote(ctx, dest, freq, type, attack, decay, vol, detune) {
            // Greyline articulation: keep SFX readable but state-shaped
            const harsh = greyline?.knobs?.skl?.soundHarsh ?? 0;
            const leg = greyline?.knobs?.aud?.legibility ?? 1;

            let amp = vol ?? 0.1;   // ✅ DEFINE AMP HERE

            const ampScale = 0.85 + leg * 0.25;
            const grit = 0.75 + harsh * 0.8;
            amp = amp * ampScale * grit;

    const g = ctx.createGain();
    const o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = freq;
    if (detune) o.detune.value = detune;
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(amp || 0.1, ctx.currentTime + (attack || 0.01));
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + (attack || 0.01) + (decay || 0.3));
    o.connect(g);
    g.connect(dest);
    o.start();
    o.stop(ctx.currentTime + (attack || 0.01) + (decay || 0.3) + 0.1);
}
// note name → frequency
const NOTE_FREQ = {};
(function buildNoteTable() {
    const names = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
    for (let oct = 0; oct <= 7; oct++) {
        for (let i = 0; i < 12; i++) {
            const midi = (oct + 1) * 12 + i;
            NOTE_FREQ[names[i] + oct] = 440 * Math.pow(2, (midi - 69) / 12);
        }
        }
    })();
function nf(n) { return NOTE_FREQ[n] || 220; }

// ============================================================
// TITLE SCREEN MUSIC — Haunting ambient, pure Web Audio API
// ============================================================
function initTitleMusic() {
    // Prevent duplicate engines
    if (titleMusicEngine) return;
    // create/use hidden audio element for MP3
    let audioEl = document.getElementById('title-mp3');
    if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.id = 'title-mp3';
        audioEl.src = 'Surround Me.mp3';
        audioEl.loop = true;
        audioEl.preload = 'auto';
        audioEl.style.display = 'none';
        document.body && document.body.appendChild(audioEl);
    }
    let triedEngine = false;
    const startProcedural = () => {
        if (triedEngine) return; triedEngine = true;
        try {
            const ctx = getAudioCtx();
            const master = createGain(ctx, 1.0);
            master.gain.value = audioConfig.titleVolume ?? 1;
            titleMasterGain = master;
            // analyser
            const meter = ctx.createAnalyser();
            meter.fftSize = 512;
            master.connect(meter);
            meter.connect(ctx.destination);
            window.__titleMeter = meter;

            const droneGain = createGain(ctx, 0.1);
            droneGain.connect(master);
            const drone1 = createOsc(ctx, 'sine', 44, droneGain);
            const droneFilter = ctx.createBiquadFilter();
            droneFilter.type = 'lowpass'; droneFilter.frequency.value = 120;
            const d2Gain = createGain(ctx, 0.04);
            droneFilter.connect(d2Gain); d2Gain.connect(master);
            const drone2 = createOsc(ctx, 'sawtooth', 66, droneFilter);
            const windFilter = ctx.createBiquadFilter();
            windFilter.type = 'lowpass'; windFilter.frequency.value = 100;
            const windGain = createGain(ctx, 0.06);
            windFilter.connect(windGain); windGain.connect(master);
            const wind = createBrownNoise(ctx, windFilter);
            const titleNotes = [
                'C3', null, 'Eb3', null, 'G3', null, 'Ab3', 'G3', null, null,
                'Eb3', null, 'D3', null, 'C3', null, null, null,
                'Bb2', null, 'C3', null, 'Eb3', null, 'F3', 'Eb3', null, null, null,
                'Ab2', null, 'G2', null, null, null, null, null,
            ];
            let noteIdx = 0, noteTimer = 2.5;
            let choirTimer = 12;
            const choirNotes = ['C2', 'Ab1', 'Eb2', 'Bb1', 'G1'];
            let choirIdx = 0;
            let fading = false;
            titleMusicEngine = {
                update(dt) {
                    if (fading) return;
                    drone1.frequency.value = 44 + Math.sin(performance.now() * 0.001 * 0.015 * Math.PI * 2) * 4;
                    windFilter.frequency.value = 100 + Math.sin(performance.now() * 0.001 * 0.025 * Math.PI * 2) * 65;
                    noteTimer -= dt;
                    if (noteTimer <= 0) {
                        const note = titleNotes[noteIdx % titleNotes.length];
                        noteIdx++;
                        noteTimer = 1.0 + Math.random() * 0.8;
                        if (note) playNote(ctx, master, nf(note), 'sine', 1.5, 4, 0.4, (Math.random()-0.5)*20);
                    }
                    choirTimer -= dt;
                    if (choirTimer <= 0) {
                        choirTimer = 15 + Math.random() * 20;
                        const cn = choirNotes[choirIdx % choirNotes.length];
                        choirIdx++;
                        playNote(ctx, master, nf(cn), 'triangle', 2, 6, 0.03);
                    }
                },
                fadeOut() {
                    fading = true;
                    const now = ctx.currentTime;
                    master.gain.linearRampToValueAtTime(0, now + 3);
                    setTimeout(() => { try { drone1.stop(); drone2.stop(); wind.stop(); } catch(e){} }, 3500);
                }
            };
            try { playNote(ctx, master, nf('C3'), 'sine', 0.01, 0.4, 0.14); } catch(e) {}
            let lastT = performance.now();
            function titleMusicLoop() {
                if (!titleMusicEngine) return;
                const now = performance.now();
                const dt = Math.min(0.1, (now - lastT) / 1000);
                lastT = now;
                titleMusicEngine.update(dt);
                if (gameState === GameState.TITLE || gameState === GameState.CONTROLS) requestAnimationFrame(titleMusicLoop);
            }
            requestAnimationFrame(titleMusicLoop);
            function meterLoop() {
                if (!window.__titleMeter) return;
                const data = new Uint8Array(window.__titleMeter.frequencyBinCount);
                window.__titleMeter.getByteTimeDomainData(data);
                let sum = 0;
                for (let i = 0; i < data.length; i++) { const v = (data[i]-128)/128; sum += v*v; }
                const rms = Math.sqrt(sum/data.length);
                const pct = Math.min(1,Math.max(0,rms*2));
                const fill = document.getElementById('audio-meter-fill'); if (fill) fill.style.width = (pct*100)+'%';
                if (Math.random()<0.01) console.log('[Audio] meter rms', rms.toFixed(3));
                requestAnimationFrame(meterLoop);
            }
            meterLoop();
            console.log('[Audio] ✓ Title music started — cue played');
            if (document.getElementById('audio-status')) document.getElementById('audio-status').innerText = 'Audio: playing (title)';
        } catch(e) { console.warn('[Audio] Title music init failed:', e); }
    };
    // now try mp3; route it through AudioContext for metering
    {
        const ctx = getAudioCtx();
        const master = createGain(ctx, 1.0);
        const meter = ctx.createAnalyser(); meter.fftSize = 512;
        master.connect(meter); meter.connect(ctx.destination);
        window.__titleMeter = meter;
        if (!window.__titleMediaSource) {
            try {
                window.__titleMediaSource = ctx.createMediaElementSource(audioEl);
                window.__titleMediaSource.connect(master);
            } catch(e) {
                console.warn('[Audio] media element source creation failed', e);
            }
        } else {
            // already created, just ensure it's connected
            try { window.__titleMediaSource.connect(master); } catch(e){}
        }
    }
    audioEl.volume = 0.8;
    audioEl.play().then(() => {
        console.log('[Audio] ✓ Title MP3 playing');
        if (document.getElementById('audio-status')) document.getElementById('audio-status').innerText = 'Audio: playing (mp3)';
        titleMusicEngine = { fadeOut() { audioEl.pause(); audioEl.currentTime = 0; } };
    }).catch(e => {
        console.warn('[Audio] Title MP3 failed, falling back to procedural engine', e);
        startProcedural();
    });
}

function initAudio() {
    if (audioEngine) return;
    try {
        const ctx = getAudioCtx();
        // Force resume on init — Chrome may still be suspended
        if (ctx.state === 'suspended') {
            ctx.resume().then(() => console.log('[Audio] initAudio: resumed OK'));
        }
        console.log('[Audio] initAudio called, ctx state:', ctx.state);
        const master = createGain(ctx, audioSettings.master);
        master.connect(ctx.destination);
        const sfxBus = createGain(ctx, audioSettings.sfx);
        sfxBus.connect(master);
        const musicBus = createGain(ctx, audioSettings.music);
        musicBus.connect(master);
        // special bus for gunshots that bypasses greyline muting/master gain
        const gunBus = createGain(ctx, 1.0);
        // gunBus bypasses master so it is always audible even if greyline mutes or lowers master
        gunBus.connect(ctx.destination);

        // ── CONVOLUTION-LIKE REVERB via delay network ──
        const reverbBus = createGain(ctx, 0.25);
        reverbBus.connect(musicBus);
        const revDelays = [0.037, 0.053, 0.071, 0.097].map(t => {
            const d = ctx.createDelay(0.1); d.delayTime.value = t;
            const g = createGain(ctx, 0.3);
            d.connect(g); g.connect(reverbBus); g.connect(d);
            return d;
        });
        reverbBus.connect(revDelays[0]);

        // ── AMBIENT BED — Perpetual wind/haze ──
        const ambFilter = ctx.createBiquadFilter();
        ambFilter.type = 'lowpass'; ambFilter.frequency.value = 140;
        const ambGain = createGain(ctx, 0.03 * audioSettings.ambient);
        ambFilter.connect(ambGain); ambGain.connect(musicBus);
        const ambientWind = createBrownNoise(ctx, ambFilter);
        
        // Sub-bass presence
        const subGain = createGain(ctx, 0.025);
        subGain.connect(musicBus);
        const subOsc = createOsc(ctx, 'sine', 33, subGain);
        
        // Second sub — fifth relationship, very quiet
        const sub2Gain = createGain(ctx, 0.012);
        sub2Gain.connect(musicBus);
        const subOsc2 = createOsc(ctx, 'sine', 49.5, sub2Gain);

        // ══════════════════════════════════════════════
        // HUB MUSIC — Tristram meets Firelink Shrine
        // Fingerpicked guitar arpeggios in C minor with 
        // warmth, melancholy, and moments of hope
        // ══════════════════════════════════════════════
        const hubMelodyGain = createGain(ctx, 0);
        hubMelodyGain.connect(musicBus);
        hubMelodyGain.connect(reverbBus);
        
        const hubBassGain = createGain(ctx, 0);
        hubBassGain.connect(musicBus);
        
        const hubPadGain = createGain(ctx, 0);
        hubPadGain.connect(musicBus);
        hubPadGain.connect(reverbBus);
        // Strummed guitar layer for atmospheric midtempo feel
        const hubStrumGain = createGain(ctx, 0);
        hubStrumGain.connect(musicBus);
        hubStrumGain.connect(reverbBus);
        
        // Neutral/Hub music — synced 4/4, 8 eighth-note steps per bar
        // New progression: I–V–vi–IV (C, G, Am, F) — moody but uplifting, arpeggiated guitars
        // Each phrase contains 8 eighth-note steps so melodies, bass and beat stay locked to the bar
        const hubPhrases = [
            // Phrase A — C major arpeggio (I)
            ['E4','G4','C5','G4','E4','G4','C5','G4'],
            // Phrase B — G major arpeggio (V)
            ['D4','G4','B4','G4','D4','G4','B4','G4'],
            // Phrase C — A minor arpeggio (vi)
            ['C4','E4','A4','E4','C4','E4','A4','E4'],
            // Phrase D — F major arpeggio (IV)
            ['C4','F4','A4','F4','C4','F4','A4','F4'],
            // Phrase E — melodic variation / counter-motif
            ['G4','E4','C5','E4','G4','E4','C5','E4'],
            // Phrase F — gentle descending turnaround
            ['C5','B4','A4','G4','E4','D4','C4','B3'],
            // Phrase G — sparse pluck for space (rests allowed)
            ['C4',null,'E4',null,'G4',null,'C5',null],
            // Phrase H — soft harmony layer
            ['E4','C5','G4','C5','E4','C5','G4','C5'],
        ];
        let hubPhraseIdx = 0, hubNoteIdx = 0, hubMelTimer = 0, hubMelInterval = 0.3;
        let hubBeatTimer = 0, hubBeatInterval = 2.4;
        let hubStrumTimer = 0; // counts quarter-note subdivisions for strums
        let hubPadTimer = 5;
        
        // bass will now be derived from the melody itself (one octave lower)
        // (old hubBassLines removed, no independent timer needed)
        let hubBassIdx = 0; // still track index for consistent rhythm if needed
        
        // Chord pads — sustained warmth
        const hubChords = [
            [nf('C2'), nf('G2'), nf('Eb3')],      // Cm
            [nf('Ab1'), nf('Eb2'), nf('C3')],      // Ab
            [nf('Eb2'), nf('Bb2'), nf('G3')],      // Eb
            [nf('F1'), nf('C2'), nf('Ab2')],        // Fm
            [nf('Bb1'), nf('F2'), nf('Db3')],       // Bbm
        ];
        let hubChordIdx = 0;
        
        // Fire crackle (only near campfire)
        const crackleFilter = ctx.createBiquadFilter();
        crackleFilter.type = 'bandpass'; crackleFilter.frequency.value = 2200; crackleFilter.Q.value = 1.5;
        const crackleGain = createGain(ctx, 0.02);
        crackleFilter.connect(crackleGain); crackleGain.connect(musicBus);
        const crackle = createNoise(ctx, crackleFilter);
        
        // ══════════════════════════════════════════════
        // VERGE MUSIC — Silent Hill 2 meets Diablo 2 wilderness
        // Oppressive drones, industrial texture, lonely piano,
        // with dynamic layers based on combat/greyline
        // ══════════════════════════════════════════════
        const vergeGain = createGain(ctx, 0);
        vergeGain.connect(musicBus);
        const vergeFilt1 = ctx.createBiquadFilter();
        vergeFilt1.type = 'lowpass'; vergeFilt1.frequency.value = 200;
        vergeFilt1.connect(vergeGain);
        const vergeDrone1 = createOsc(ctx, 'sawtooth', 55, vergeFilt1);
        const vergeFilt2 = ctx.createBiquadFilter();
        vergeFilt2.type = 'lowpass'; vergeFilt2.frequency.value = 150;
        vergeFilt2.connect(vergeGain);
        const vergeDrone2 = createOsc(ctx, 'sine', 82.5, vergeFilt2);
        
        // Second drone layer — dissonant fifth that wobbles
        const vergeFilt3 = ctx.createBiquadFilter();
        vergeFilt3.type = 'lowpass'; vergeFilt3.frequency.value = 100;
        const vDrone3Gain = createGain(ctx, 0);
        vergeFilt3.connect(vDrone3Gain); vDrone3Gain.connect(musicBus);
        const vergeDrone3 = createOsc(ctx, 'triangle', 41.25, vergeFilt3); // dim5
        
        // Industrial texture layer — filtered square wave pulsing
        const industrialFilter = ctx.createBiquadFilter();
        industrialFilter.type = 'bandpass'; industrialFilter.frequency.value = 300; industrialFilter.Q.value = 3;
        const industrialGain = createGain(ctx, 0);
        industrialFilter.connect(industrialGain); industrialGain.connect(musicBus);
        const industrialOsc = createOsc(ctx, 'square', 27.5, industrialFilter);
        
        // Verge melodic fragments — piano-like sine tones with reverb
        // SH2 "Promise" / "Theme of Laura" inspired — lonely, questioning, human
        const vergeMelPhrases = [
            // Promise-like: descending minor figures
            ['Eb4','D4','C4','Bb3',null,'G3','Ab3','G3'],
            // Ascending hope that doesn't resolve
            ['C3','Eb3','F3','G3',null,'Ab3','G3','Eb3'],
            // Laura-like: simple repeated motif
            ['G3','Ab3','Bb3','Ab3','G3',null,'Eb3','F3'],
            // Questioning descent
            ['Bb3','Ab3','G3','F3','Eb3',null,null,'C3'],
            // Two-note sigh motif
            ['Eb4','D4',null,null,'C4','Bb3',null,null],
            // Dark cluster — brief dissonance
            ['F#3','G3',null,'Ab3','G3','F3',null,null],
            // Wide interval — yearning
            ['C3',null,'G4',null,null,'Eb4',null,'C4'],
            // Stillness broken
            [null,null,'Ab3',null,null,'G3',null,null],
        ];
        let vergeMelIdx = 0, vergeMelNoteIdx = 0, vergeMelTimer = 0;
        let vergeMelInterval = 0.7, vergeMelActive = false, vergeMelCooldown = 8;
        
        // Wind howl timers
        let windTimer = 0, nextWindTime = 3 + Math.random() * 6;
        // Industrial clang timers
        let clangTimer = 0, nextClangTime = 12 + Math.random() * 20;
        // Distant rumble timers
        let rumbleTimer = 0, nextRumbleTime = 20 + Math.random() * 35;
        
        // Combat system
        let combatIntensity = 0;
        let combatPulseTimer = 0;
        let combatDrumTimer = 0;
        
        // ── HELPER: play a "guitar" note (triangle + slight detune + fast attack) ──
        function playGuitar(dest, freq, vol, decay) {
            const now = ctx.currentTime;
            // Body tone
            const o1 = ctx.createOscillator(); o1.type = 'triangle'; o1.frequency.value = freq;
            const g1 = ctx.createGain();
            g1.gain.setValueAtTime(0, now);
            g1.gain.linearRampToValueAtTime(vol, now + 0.003);
            g1.gain.exponentialRampToValueAtTime(vol * 0.4, now + 0.08);
            g1.gain.exponentialRampToValueAtTime(0.001, now + (decay || 1.8));
            o1.connect(g1); g1.connect(dest);
            o1.start(now); o1.stop(now + (decay || 1.8) + 0.1);
            // Harmonic shimmer
            const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2.005;
            const g2 = ctx.createGain();
            g2.gain.setValueAtTime(0, now);
            g2.gain.linearRampToValueAtTime(vol * 0.15, now + 0.002);
            g2.gain.exponentialRampToValueAtTime(0.001, now + (decay || 1.8) * 0.6);
            o2.connect(g2); g2.connect(dest);
            o2.start(now); o2.stop(now + (decay || 1.8) * 0.6 + 0.1);
            // String noise on pluck
            const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.015), ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
            const ns = ctx.createBufferSource(); ns.buffer = buf;
            const nf2 = ctx.createBiquadFilter(); nf2.type = 'bandpass'; nf2.frequency.value = freq * 3; nf2.Q.value = 2;
            const ng = ctx.createGain();
            ng.gain.setValueAtTime(vol * 0.4, now);
            ng.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
            ns.connect(nf2); nf2.connect(ng); ng.connect(dest);
            ns.start(now); ns.stop(now + 0.04);
        }
        
        // ── HELPER: play a "piano" note (sine + harmonics, medium attack) ──
        function playPiano(dest, freq, vol, decay) {

        // ── HELPER: play a quick strum of a chord (staggered pluck) ──
        function playStrum(dest, chordFreqs, vol, decay, down = true) {
            // chordFreqs: array of numeric freqs (null allowed for rests)
            const stepMs = 36; // milliseconds between adjacent strings for a gentle strum
            if (!Array.isArray(chordFreqs)) return;
            const order = down ? [...chordFreqs.keys()] : [...chordFreqs.keys()].reverse();
            for (let i = 0; i < order.length; i++) {
                const idx = order[i];
                const f = chordFreqs[idx];
                if (!f) continue;
                // schedule with a small timeout for humanized strum
                setTimeout(() => {
                    try {
                        playGuitar(dest, f, vol * (1 - i * 0.06), decay || 1.4);
                    } catch (e) {}
                }, i * stepMs);
            }
        }
            const now = ctx.currentTime;
            const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = freq;
            const g1 = ctx.createGain();
            g1.gain.setValueAtTime(0, now);
            g1.gain.linearRampToValueAtTime(vol, now + 0.01);
            g1.gain.exponentialRampToValueAtTime(vol * 0.5, now + 0.3);
            g1.gain.exponentialRampToValueAtTime(0.001, now + (decay || 3.5));
            o1.connect(g1); g1.connect(dest);
            o1.start(now); o1.stop(now + (decay || 3.5) + 0.1);
            // Second harmonic
            const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2;
            const g2 = ctx.createGain();
            g2.gain.setValueAtTime(0, now);
            g2.gain.linearRampToValueAtTime(vol * 0.2, now + 0.005);
            g2.gain.exponentialRampToValueAtTime(0.001, now + (decay || 3.5) * 0.4);
            o2.connect(g2); g2.connect(dest);
            o2.start(now); o2.stop(now + (decay || 3.5) * 0.4 + 0.1);
            // Third harmonic
            const o3 = ctx.createOscillator(); o3.type = 'sine'; o3.frequency.value = freq * 3;
            const g3 = ctx.createGain();
            g3.gain.setValueAtTime(0, now);
            g3.gain.linearRampToValueAtTime(vol * 0.06, now + 0.003);
            g3.gain.exponentialRampToValueAtTime(0.001, now + (decay || 3.5) * 0.2);
            o3.connect(g3); g3.connect(dest);
            o3.start(now); o3.stop(now + (decay || 3.5) * 0.2 + 0.1);
        }
        
        // ── HELPER: play a "pad" chord (slow attack sine cluster) ──
        function playPad(dest, freqs, vol, attack, decay) {
            const now = ctx.currentTime;
            for (const freq of freqs) {
                const o = ctx.createOscillator(); o.type = 'sine';
                o.frequency.value = freq;
                o.detune.value = (Math.random() - 0.5) * 10;
                const g = ctx.createGain();
                g.gain.setValueAtTime(0, now);
                g.gain.linearRampToValueAtTime(vol / freqs.length, now + (attack || 2));
                g.gain.linearRampToValueAtTime(vol / freqs.length * 0.6, now + (attack || 2) + (decay || 5) * 0.5);
                g.gain.linearRampToValueAtTime(0, now + (attack || 2) + (decay || 5));
                o.connect(g); g.connect(dest);
                o.start(now); o.stop(now + (attack || 2) + (decay || 5) + 0.2);
            }
        }

        // Helper: short noise burst for SFX
        function playNoiseBurst(dur, filterFreq, filterType, vol) {
            // Greyline articulation: keep SFX readable but state-shaped
            const harsh = greyline?.knobs?.skl?.soundHarsh ?? 0;
            const leg = greyline?.knobs?.aud?.legibility ?? 1;
            const volScale = 0.85 + leg * 0.25;
            const grit = 0.75 + harsh * 0.8;
            vol = vol * volScale * grit;

            const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = (Math.random()*2-1);
            const src = ctx.createBufferSource();
            src.buffer = buf;
            const f = ctx.createBiquadFilter();
            f.type = filterType || 'highpass'; f.frequency.value = filterFreq || 3000;
            const g = ctx.createGain();
            g.gain.setValueAtTime(vol || 0.15, ctx.currentTime);
            g.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
            src.connect(f); f.connect(g); g.connect(sfxBus);
            src.start(); src.stop(ctx.currentTime + dur + 0.05);
        }

        audioEngine = {
            started: true, ctx, sfxBus, musicBus, gunBus, master, ambGain,
            combatIntensity: 0,
            // internal envelope state for sub-bass pulses
            _subPulseLevel: 0.0001,
            applySettings() {
                master.gain.value = audioSettings.master;
                // Boost SFX bus heavily so attacks, gunshots etc. punch
                sfxBus.gain.value = (audioSettings.sfx || 1.0) * 2.5;
                // Make music bus louder to let layers breathe; scale further under compulsion
                // raised from 1.5 to 2.0 for generally louder melodies
                let musicMul = (audioSettings.music || 1.0) * 2.0;
                try {
                    if (greyline && greyline.getSide() === 'compulsion') {
                        // muddy compulsion: make the music more chaotic but louder
                        musicMul *= 1 + Math.pow(greyline.getExtremity(), 1.8) * 0.6;
                    }
                } catch(e) {}
                musicBus.gain.value = Math.min(2.0, musicMul);
                ambGain.gain.value = 0.05 * (audioSettings.ambient || 1.0);
            },
            
            // === SFX ===
            playAttack() {
                playNoiseBurst(0.1, 3000, 'highpass', 0.18);
                playNote(ctx, sfxBus, 800, 'sine', 0.005, 0.08, 0.05);
                playNote(ctx, sfxBus, 1200, 'sine', 0.003, 0.04, 0.02);
            },
            playHit() {
                playNote(ctx, sfxBus, 55, 'sine', 0.005, 0.15, 0.22);
                playNote(ctx, sfxBus, 110, 'triangle', 0.005, 0.1, 0.08);
                playNoiseBurst(0.06, 200, 'lowpass', 0.12);
                combatIntensity = Math.min(1, combatIntensity + 0.15);
            },
            playDash() {
                playNoiseBurst(0.15, 1500, 'bandpass', 0.18);
                playNote(ctx, sfxBus, 200, 'sine', 0.01, 0.12, 0.04);
                playNote(ctx, sfxBus, 350, 'sine', 0.005, 0.18, 0.03);
                playNoiseBurst(0.08, 2500, 'highpass', 0.06);
            },
            playDeath(type) {
                const pitches = {
                    lingering: 98, watchful: 82, huddled: 73, rehearsed: 92,
                    burdened: 65, drifting: 110, deferred: 77, remembered: 116
                };
                const freq = pitches[type] || 65;
                playNote(ctx, sfxBus, freq, 'sawtooth', 0.01, 0.8, 0.1);
                playNote(ctx, sfxBus, freq * 0.5, 'sine', 0.05, 1.0, 0.07);
                playNoiseBurst(0.3, freq * 2, 'bandpass', 0.06);
            },
            playPlayerHit() {
                playNote(ctx, sfxBus, 40, 'sine', 0.005, 0.2, 0.25);
                playNoiseBurst(0.08, 500, 'lowpass', 0.18);
                combatIntensity = Math.min(1, combatIntensity + 0.2);
            },
            playSnare() {
                playNote(ctx, sfxBus, nf('E4'), 'triangle', 0.01, 0.3, 0.08);
                playNote(ctx, sfxBus, nf('B4'), 'sine', 0.02, 0.2, 0.05);
                playNote(ctx, sfxBus, nf('G#4'), 'sine', 0.08, 0.4, 0.03);
                playNoiseBurst(0.05, 5000, 'highpass', 0.05);
            },
            playReclaim() {
                playNote(ctx, sfxBus, nf('C2'), 'sine', 0.3, 1.5, 0.1);
                playNote(ctx, sfxBus, nf('G2'), 'triangle', 0.5, 1.0, 0.05);
                playNoiseBurst(0.4, 150, 'lowpass', 0.07);
                playNoiseBurst(0.15, 400, 'bandpass', 0.08);
                playNote(ctx, sfxBus, nf('Eb3'), 'sine', 0.8, 1.5, 0.025);
            },
            playAttune() {
                playNote(ctx, sfxBus, nf('G4'), 'sine', 0.2, 1.2, 0.07);
                playNote(ctx, sfxBus, nf('D5'), 'sine', 0.3, 1.0, 0.04);
                playNote(ctx, sfxBus, nf('B4'), 'triangle', 0.25, 0.9, 0.03);
                playNote(ctx, sfxBus, nf('F#5'), 'sine', 0.5, 0.8, 0.025);
                playNoiseBurst(0.5, 6000, 'bandpass', 0.015);
            },
            playBurdenShift() {
                playNote(ctx, sfxBus, 35, 'sine', 0.005, 0.4, 0.25);
                playNoiseBurst(0.12, 120, 'lowpass', 0.2);
                playNoiseBurst(0.06, 800, 'bandpass', 0.12);
                playNote(ctx, sfxBus, 55, 'triangle', 0.1, 0.8, 0.05);
                playNote(ctx, sfxBus, 28, 'sine', 0.05, 0.6, 0.06);
            },
            playShadow() {
                playNote(ctx, sfxBus, nf('C2'), 'sawtooth', 0.03, 0.8, 0.12);
                playNote(ctx, sfxBus, nf('Eb2'), 'sawtooth', 0.05, 0.6, 0.07);
                playNoiseBurst(0.3, 400, 'lowpass', 0.1);
                playNote(ctx, sfxBus, nf('F#2'), 'sawtooth', 0.1, 1.0, 0.04, 30);
                playNote(ctx, sfxBus, nf('Bb1'), 'sine', 0.08, 1.2, 0.05);
                playNoiseBurst(0.5, 1200, 'bandpass', 0.03);
            },
            playEnemyHurt(type) {
                const pitches = {
                    lingering: 180, watchful: 110, huddled: 200, rehearsed: 150,
                    burdened: 70, drifting: 250, deferred: 130, remembered: 160
                };
                const freq = pitches[type] || 140;
                playNoiseBurst(0.08, freq * 3, 'bandpass', 0.2);
                playNote(ctx, sfxBus, freq, 'sawtooth', 0.005, 0.12, 0.15);
                playNote(ctx, sfxBus, freq * 1.5, 'square', 0.005, 0.06, 0.06);
            },
            playFootstep() {
                playNoiseBurst(0.04, 300, 'lowpass', 0.05);
            },
            
            // ══════════════════════════════════════
            // MUSIC UPDATE — Called every frame
            // ══════════════════════════════════════
            
            // ================================================================
            // Gun / reload SFX (minimalistic, Silent-Hill-adjacent: presence > punch)
            // ================================================================
            playGunShot(compulsionWeight = 0, extremity = 0) {
                if (!audioSettings.enabled) return;
                console.log('[Gun] shot triggered', compulsionWeight, extremity, 'aud.mute', greyline?.knobs?.aud?.mute,
                    'sfxGain', sfxBus.gain.value.toFixed(2), 'gunGain', gunBus.gain.value.toFixed(2));
                // small HF noise click for presence — avoid HF clicks when in restraint
                try { if (greyline.getSide() !== 'restraint') playNoiseBurst(0.02, 8000, 'highpass', 0.12); } catch(e){}
                const now = ctx.currentTime;
                const wR = Math.max(0, compulsionWeight);
                // temporarily boost gunBus gain for clarity
                try { gunBus.gain.setValueAtTime(4.0, now); gunBus.gain.exponentialRampToValueAtTime(1.0, now + 0.5); } catch(e) {}

                // Short filtered noise (the "bang" edge)
                try {
                    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
                    const d = buf.getChannelData(0);
                    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
                    const src = ctx.createBufferSource(); src.buffer = buf;
                    const filt = ctx.createBiquadFilter(); filt.type = 'highpass'; filt.frequency.value = 1200 + wR * 2400;
                    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, now);
                    // louder transient for punch
                    g.gain.exponentialRampToValueAtTime(1.2 + wR * 0.6, now + 0.004);
                    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18 + wR * 0.1);
                    src.connect(filt); filt.connect(g); g.connect(gunBus);
                    src.start(now); src.stop(now + 0.08 + wR * 0.06);
                } catch (e) {}
                // extra crackling muzzle burst
                try { playNoiseBurst(0.02, 4000, 'highpass', 0.1); } catch(e){}

                // Low thump for body (sine), intensity rises with compulsion
                try {
                    const thump = ctx.createOscillator();
                    const thumpG = ctx.createGain();
                    thump.type = 'sine';
                    const baseFreq = 60 + wR * 60; // 60 -> 120
                    thump.frequency.setValueAtTime(baseFreq, now);
                    thump.frequency.exponentialRampToValueAtTime(40, now + 0.08);
                    thumpG.gain.setValueAtTime(0.0001, now);
                    thumpG.gain.exponentialRampToValueAtTime(0.84 + wR * 0.48, now + 0.01);
                    thumpG.gain.exponentialRampToValueAtTime(0.0001, now + 0.36 + wR * 0.18);
                    thump.connect(thumpG); thumpG.connect(gunBus);
                    thump.start(now); thump.stop(now + 0.26 + wR * 0.12);
                } catch (e) {}
                // secondary rumble/echo
                try {
                    const echo = ctx.createOscillator();
                    const echoG = ctx.createGain();
                    echo.type = 'triangle';
                    echo.frequency.setValueAtTime(120 + wR * 80, now);
                    echo.frequency.exponentialRampToValueAtTime(50, now + 0.2);
                    echoG.gain.setValueAtTime(0.0001, now + 0.05);
                    echoG.gain.exponentialRampToValueAtTime(0.25 + wR * 0.2, now + 0.06);
                    echoG.gain.exponentialRampToValueAtTime(0.0001, now + 0.5 + wR * 0.3);
                    echo.connect(echoG); echoG.connect(gunBus);
                    echo.start(now + 0.04); echo.stop(now + 0.5 + wR * 0.3);
                } catch(e) {}

                // Optional metallic ring for clarity (short, subtle)
                if (Math.random() < 0.6) {
                    try { playNote(ctx, sfxBus, 900 + wR * 300, 'triangle', 0.002, 0.12, 0.03); } catch (e) {}
                }
            },

            playGunHit(isCrit = 0) {
                if (!audioSettings.enabled) return;
                const now = audioCtx.currentTime;
                const osc = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(isCrit ? 820 : 520, now);
                osc.frequency.exponentialRampToValueAtTime(isCrit ? 360 : 280, now + 0.06);
                g.gain.setValueAtTime(0.0001, now);
                g.gain.exponentialRampToValueAtTime(isCrit ? 0.14 : 0.10, now + 0.005);
                g.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
                osc.connect(g).connect(sfxBus);
                osc.start(now);
                osc.stop(now + 0.09);
            },

            playReload() {
                if (!audioSettings.enabled) return;
                const now = audioCtx.currentTime;
                const osc = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(110, now);
                osc.frequency.exponentialRampToValueAtTime(70, now + 0.08);
                g.gain.setValueAtTime(0.0001, now);
                g.gain.exponentialRampToValueAtTime(0.10, now + 0.01);
                g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
                osc.connect(g).connect(sfxBus);
                osc.start(now);
                osc.stop(now + 0.14);
            },

            playReloadComplete() {
                if (!audioSettings.enabled) return;
                const now = audioCtx.currentTime;
                const osc = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(260, now);
                osc.frequency.exponentialRampToValueAtTime(520, now + 0.06);
                g.gain.setValueAtTime(0.0001, now);
                g.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
                g.gain.exponentialRampToValueAtTime(0.0001, now + 0.10);
                osc.connect(g).connect(sfxBus);
                osc.start(now);
                osc.stop(now + 0.11);
            },

update(dt) {
                // if audio globally disabled, skip everything
                if (!audioSettings.enabled) return;
                const inHub = isPlayerInHub();
                const side = greyline.getSide();
                const extr = greyline.getExtremity();
                const t = performance.now() * 0.001;
                
                // demo override forces a fixed greyline value during title demo
                if (demoMode) {
                    demoTimer -= dt;
                    if (demoTimer <= 0) {
                        demoMode = null;
                        greyline.g = demoOriginalG;
                    }
                }
                // Greyline audio controls (never silent; flux = legible, extremes = distorted)
                const g = demoMode ? (demoMode === 'compulsion' ? 1 : demoMode === 'restraint' ? -1 : 0) : (greyline.g ?? 0);
                const a = Math.min(1, Math.abs(g));
                const wB = 1.0 - a; // balance weight — high when near centre
                const wL = Math.max(0, -g);
                const wR = Math.max(0, +g);
                const v = greyline.v ?? 0;
                const samTier = greyline.samTier ?? 0;

                const aud = greyline.knobs?.aud || {};
                // aud.mute is a restraint-driven dampening knob (0..1)
                const audMute = clamp01(aud.mute ?? 0);
                const musicMuteFactor = 1 - audMute * 0.85; // how much to attenuate music layers
                const sfxMuteFactor = 1 - audMute * 0.6;    // how much to attenuate SFX

                const leg = (aud.legibility ?? (0.6 + (greyline.isBalanced() ? 0.35 : -0.05)));
                const dens = (aud.density ?? (0.25 + wR * 0.75 + samTier * 0.15));
                const dis  = (aud.dis ?? (wR * 0.35 + v * 0.25 + samTier * 0.20));
                const lf   = (aud.lf ?? (wR * 0.50 + samTier * 0.20));

                // Tempo is *perceived* time (restraint slows; compulsion accelerates)
                const timeScale = greyline.knobs?.timeScale ?? 1.0;
                // Raise tempo cap so music can feel significantly faster at deep compulsion
                const tempoScale = Math.min(1.6, Math.max(0.78, timeScale * (1.0 - wL * 0.10 + wR * 0.10)));
                
                // ── CONTINUOUS LFOs ──
                subOsc.frequency.value = 33 + Math.sin(t * 0.05) * 4;
                subOsc2.frequency.value = 49.5 + Math.sin(t * 0.032) * 2;
                ambFilter.frequency.value = 140 + Math.sin(t * 0.125) * 65;
                vergeDrone2.frequency.value = 82.5 + Math.sin(t * 0.314) * 2;
                vergeDrone3.frequency.value = 41.25 + Math.sin(t * 0.07) * 1.5;
                crackleFilter.frequency.value = 2200 + Math.sin(t * 5) * 600;
                industrialFilter.frequency.value = 300 + Math.sin(t * 0.2) * 150;

                // ── SUB‑BASS REGIMES (explicit BPM / pulse envelopes) ──
                // reuse existing `side` and `extr` declared above

                // target BPM per behavioural state
                let targetSubBpm = 90; // default (balance will override)
                if (side === 'compulsion') {
                    // Dramatic, dance/metal-like fast pulses (scaled by extremity)
                    targetSubBpm = 160 + Math.round(extr * 160); // ~160 → 320+ BPM
                } else if (side === 'greyline') {
                    // Steady 4/4 — moderate, consistent beat
                    targetSubBpm = 96; // steady quarter-note feel
                } else if (side === 'restraint') {
                    // Long, monotonous drone — very slow pulses
                    targetSubBpm = 24; // long drone
                }

                // expose for debugging/UI
                audioEngine.subBpm = targetSubBpm;

                // beat pulse timing: use quarter-note rate so the pulse follows the 4/4 beat
                // (seconds per quarter note = 60 / BPM)
                const pulseInterval = (60 / Math.max(1, targetSubBpm)) / (audioConfig.tempoFactor || 1); // seconds per quarter‑note
                _subBeatTimer += dt;

                // compute a short pulse envelope when a beat occurs
                let pulseLevel = 0;
                while (_subBeatTimer >= pulseInterval) {
                    _subBeatTimer -= pulseInterval;
                    // pulse strength scales with state (compulsion strongest)
                    if (side === 'compulsion') pulseLevel = Math.max(pulseLevel, 1.0);
                    else if (side === 'greyline') pulseLevel = Math.max(pulseLevel, 0.55);
                    else pulseLevel = Math.max(pulseLevel, 0.25);
                    _subLastPulse = TIME.elapsed;
                }

                // envelope decay for pulse (fast attack, variable decay)
                const sincePulse = TIME.elapsed - (_subLastPulse || 0);
                const decay = side === 'compulsion' ? 0.12 : side === 'greyline' ? 0.30 : 0.9;
                const env = Math.max(0, pulseLevel * Math.exp(-sincePulse / decay));

                // base sub level (drone) and pulse additive
                const baseSub = 0.015 + (lf * 0.025); // baseline influenced by aud.lf
                const pulseAdd = env * (side === 'compulsion' ? 0.32 : side === 'greyline' ? 0.12 : 0.06) * (audioConfig.subBassVolume ?? 1);

                // apply with smoothing so it doesn't click
                const subTarget = Math.min(0.8, baseSub + pulseAdd);
                audioEngine._subPulseLevel += (subTarget - audioEngine._subPulseLevel) * 0.28;
                // Make sub‑bass perceived loudness follow the Verge drone so their dynamics feel equally weighted.
                // Base sub volume tracks the verge drone gain; pulses add on top.
                const baseSubFromDrone = (vergeGain?.gain?.value || 0) * 0.25; // much lower coefficient to cut hum
                let finalSub = Math.max(0.0001, baseSubFromDrone + audioEngine._subPulseLevel);
                // scale overall sub volume by user setting too, so pulses and drone both louder
                subGain.gain.value = finalSub * (audioConfig.subBassVolume ?? 1);
                // subtle second sub layer modulation
                subOsc2.frequency.value = 49.5 + Math.sin(t * 0.032) * 2 + (side === 'compulsion' ? extr * 6 : 0);

                
                // ── REGION CROSSFADE ──
                const hubDist = Math.sqrt((player.x - WORLD_SIZE / 2) ** 2 + (player.y - WORLD_SIZE / 2) ** 2);
                const hubProx = Math.max(0, 1 - hubDist / (HUB_SAFE_RADIUS * 1.5));
                const smoothRate = dt * 0.6;
                
                // Hub music: fades in/out smoothly
                // Make hub melodic layers more audible (raise targets)
                // boost factors so melodies, bass and pad are more prominent
                const MELODY_BOOST = 2.0;
                const BASS_BOOST   = 2.5;
                const PAD_BOOST    = 2.5;

                // keep hub melody playing at full target level no matter where the player is
                const hubMelTarget = 0.28 * MELODY_BOOST * musicMuteFactor * (audioConfig.hubMelodyVolume ?? 1);
                hubMelodyGain.gain.value += (hubMelTarget - hubMelodyGain.gain.value) * smoothRate;
                // make bass much more insistent – higher target and stronger boost
                const hubBassTarget = (inHub ? 0.22 : 0) * BASS_BOOST * musicMuteFactor * (audioConfig.hubBassVolume ?? 1);
                hubBassGain.gain.value += (hubBassTarget - hubBassGain.gain.value) * smoothRate;
                const hubPadTarget = (inHub ? 0.08 : 0) * PAD_BOOST * musicMuteFactor;
                hubPadGain.gain.value += (hubPadTarget - hubPadGain.gain.value) * smoothRate;

                // Verge drones: fade in as you leave hub (attenuated by music mute)
                // Verge / compulsion: increase drone/industrial intensity so compulsion sounds chaotic
                const compScale = (side === 'compulsion') ? (1.8 + extr * 0.8) : 1.0;
                // Verge drones/industrial layers should still play in hub, just quieter
                // quieter base weights for the pervasive Verge drones
                let vergeBase = 0.025 + extr * 0.03;    // lowered from 0.06
                let v3base   = 0.010 + extr * 0.01;    // likewise reduced
                let indBase  = (inHub ? 0.001 : 0.003);
                if (inHub) {
                    // cut to 40% in hub so hub melodies remain prominent
                    vergeBase *= 0.4;
                    v3base *= 0.4;
                    indBase *= 0.4;
                }
                const vergeDroneTarget = ((vergeBase * (0.9 + dens * 0.65)) * compScale) * musicMuteFactor;
                vergeGain.gain.value += (vergeDroneTarget - vergeGain.gain.value) * smoothRate;
                const vDrone3Target = (v3base * compScale) * musicMuteFactor;
                vDrone3Gain.gain.value += (vDrone3Target - vDrone3Gain.gain.value) * smoothRate;
                const industrialTarget = (((indBase + combatIntensity * (0.018 + dens * 0.030) + extr * 0.02) * compScale) * musicMuteFactor);
                industrialGain.gain.value += (industrialTarget - industrialGain.gain.value) * smoothRate;
                
                // Fire crackle proximity
                crackleGain.gain.value = (0.006 + hubProx * 0.018) + dis * 0.012 + (side === 'compulsion' ? extr * 0.010 : 0);
                
                // ═══════════════════════════════════
                // HUB MUSIC — Tristram-style fingerpicking
                // ═══════════════════════════════════
                if (hubMelodyGain.gain.value > 0.01) {
                    hubMelTimer += dt;
                    if (hubMelTimer > hubMelInterval) {
                        hubMelTimer = 0;
                        // Varied rhythm: some notes faster, some slower (like real guitar)
                        // make melody interval derive from the current beat BPM so they stay in lockstep
                        let effTempo = audioConfig.tempoFactor || 1;
                        if (Math.abs(g) < 0.1) effTempo = 1; // neutral zone ignores user tempo tweaks
                        // targetSubBpm was calculated earlier in this same update frame
                        // Use a modest "normal song" BPM in neutral so the loop feels like a song
                        let baseMelBpm = targetSubBpm || 96;
                        if (Math.abs(g) < 0.1) baseMelBpm = (audioConfig.neutralBpm || 100);
                        // add a subtle randomness so it doesn't feel mechanical
                        const jitter = (Math.random() * 0.12 - 0.06); // ±6% variation
                        // hubPhrases are 8 steps representing eighth notes in 4/4 — compute eighth-note interval
                        hubMelInterval = (60 / baseMelBpm) / 2 * (1 + jitter) / effTempo; // seconds per eighth note
                        // also update bar / beat interval (4 beats per bar)
                        hubBeatInterval = (60 / baseMelBpm) * 4 / effTempo;
                        // pitch warp strength from settings
                        const pitchWarp = audioConfig.pitchWarpStrength ?? 1; 
                        const pitchFactor = audioConfig.pitchFactor || 1;
                        
                        const phrase = hubPhrases[hubPhraseIdx % hubPhrases.length];
                        const noteStr = phrase[hubNoteIdx % phrase.length];
                        hubNoteIdx++;
                        
                        if (noteStr) {
                            let freq = nf(noteStr);
                            // twist pitch when player is pulled to one side or the other
                            const twist = ((wR - wL) * 0.25 + extr * 0.06) * pitchWarp; // positive = higher pitch (compulsion), negative = lower (restraint)
                            freq *= 1 + twist;
                            // global pitch factor applied after warp
                            freq *= pitchFactor;
                            // **key/scale warp:** slide away from pleasant major scale when extremes occur
                            if (wR > 0.5) {
                                // flatten scale up to 2 semitones as compulsion grows
                                const semis = -(wR - 0.5) * 4; // -2 at wR==1
                                freq *= Math.pow(2, semis / 12);
                            } else if (wL > 0.5) {
                                // sharpen slightly in deep restraint (minor-to-major shift)
                                const semis = (wL - 0.5) * 2; // up to +1 semitone
                                freq *= Math.pow(2, semis / 12);
                            }
                            // Alternate velocity for natural feel, but also wobble with extremes
                            const vel = (0.08 + Math.random() * 0.04) * (1 + (wR - wL) * 0.1);
                            const decay = 1.5 + Math.random() * 0.8;
                            playGuitar(hubMelodyGain, freq, vel, decay);
                            // also trigger bass on alternating melody notes
                            if (hubBassIdx % 2 === 0) {
                                let bf = freq * 0.5; // one octave down (freq already tempo‑shifted)
                                const twistB = ((wR - wL) * 0.12 + extr * 0.03) * (audioConfig.bassWarpStrength ?? 1);
                                bf *= 1 + twistB;
                                const bvel = 0.12 * (audioConfig.hubBassVolume ?? 1) * (1 + (wR - wL) * 0.2);
                                playGuitar(hubBassGain, bf, bvel, 3.5);
                                playGuitar(hubBassGain, bf * 0.5, bvel * 0.5, 3.5);
                                if ((audioConfig.hubBassVolume || 1) > 1.5) {
                                    try { playNote(ctx, sfxBus, bf, 'sine', 0.01, 0.3, 0.15 * ((audioConfig.hubBassVolume||1) - 1)); } catch(e){}
                                }
                            }
                            hubBassIdx++;
                            // glitchy bleeps at very high extremes
                            if ((wR > 0.8 || wL > 0.8) && Math.random() < 0.18) {
                                try { playNoiseBurst(0.02, 1200 + Math.random() * 800, 'lowpass', 0.04); } catch(e){}
                            }
                            // Balanced greyline: add soft harmony/pad for more tonal richness
                            if (wB > 0.55) {
                                playGuitar(hubMelodyGain, freq * 1.5, vel * 0.55 * (audioConfig.neutralHarmony ?? 1), decay * 0.9);
                                if (Math.random() < 0.5 * (audioConfig.neutralHarmony ?? 1)) playPad(hubPadGain, [freq * 0.5, freq * 1.0, freq * 1.5], 0.02, 1.2, 6);
                            }
                        }
                        
                        // Move to next phrase after completing current
                        if (hubNoteIdx >= phrase.length) {
                            hubNoteIdx = 0;
                            hubPhraseIdx++;
                            // Brief pause between phrases
                            hubMelTimer = -0.6 - Math.random() * 0.8;
                        }
                    }
                    
                    // bass is now played alongside whichever melody note just sounded
                    // use hubBassIdx to keep count for occasional rests/harmony
                    // we trigger the bass inside the melody section below
                    
                    // Pad chords — very slow evolving warmth
                    hubPadTimer += dt;
                    if (hubPadTimer > 14 + Math.random() * 8) {
                        hubPadTimer = 0;
                        const chord = hubChords[hubChordIdx % hubChords.length];
                        hubChordIdx++;
                        playPad(hubPadGain, chord, 0.04, 2.5, 8);
                    }

                    // Strummed chord layer — lock to quarter-note grid (4/4) for midtempo atmosphere
                    hubStrumTimer += dt;
                    // compute current quarter-note interval from base BPM (use targetSubBpm computed above)
                    const curBpm = (Math.abs(g) < 0.1) ? (audioConfig.neutralBpm || 100) : targetSubBpm;
                    const quarter = (60 / Math.max(1, curBpm)) / (audioConfig.tempoFactor || 1);
                    if (hubStrumTimer >= quarter) {
                        hubStrumTimer -= quarter;
                        // choose chord from hubChords cycle but map to musical voicings for strum
                        const chordIdx = hubChordIdx % hubChords.length;
                        const chord = hubChords[chordIdx];
                        // convert chord note numbers (already nf converted) back to freqs array
                        const freqs = chord.map(n => n ? n : null);
                        // strum parameters: low vol, slightly wide decay for atmosphere
                        const strumVol = 0.06 * (audioConfig.hubMelodyVolume ?? 1);
                        const strumDecay = 2.4;
                        // alternate down/up stroke for realism
                        const down = (hubStrumTimer % (quarter * 8)) < (quarter * 4);
                        playStrum(hubStrumGain, freqs, strumVol, strumDecay, down);
                        // gently open the gain for the strum layer so it crossfades in hub
                        hubStrumGain.gain.value += (0.06 * (audioConfig.hubMelodyVolume ?? 1) - hubStrumGain.gain.value) * 0.24;
                    } else {
                        // decay the strum gain when not actively triggering
                        hubStrumGain.gain.value += (0 - hubStrumGain.gain.value) * 0.06;
                    }
                }
                
                // ═══════════════════════════════════
                // VERGE MUSIC — SH2 ambient dread + lonely melody
                // ═══════════════════════════════════
                if (!inHub) {
                    // Wind howls — organic, varying (scaled by ambient setting)
                    windTimer += dt;
                    if (windTimer > nextWindTime) {
                        windTimer = 0;
                        nextWindTime = 4 + Math.random() * 8;
                        const windFreq = 350 + Math.random() * 400;
                        const windDur = 0.8 + Math.random() * 1.2;
                        const windVol = (0.02 + Math.random() * 0.015) * audioSettings.ambient;
                        playNoiseBurst(windDur, windFreq, 'bandpass', windVol);
                    }
                    
                    // Industrial clangs — distant, metallic, SH2 factory sounds
                    clangTimer += dt;
                    if (clangTimer > nextClangTime) {
                        clangTimer = 0;
                        nextClangTime = 10 + Math.random() * 20;
                        const metalFreq = 50 + Math.random() * 90;
                        playNote(ctx, musicBus, metalFreq, 'square', 0.002, 1.8, 0.04);
                        playNote(ctx, musicBus, metalFreq * 2.3, 'sawtooth', 0.001, 0.5, 0.015);
                        // Resonant metal ring
                        playNote(ctx, musicBus, metalFreq * 5, 'sine', 0.001, 0.3, 0.008);
                    }
                    
                    // Deep rumbles — seismic, unsettling
                    rumbleTimer += dt;
                    if (rumbleTimer > nextRumbleTime) {
                        rumbleTimer = 0;
                        nextRumbleTime = 18 + Math.random() * 30;
                        playNote(ctx, musicBus, 25 + Math.random() * 15, 'sine', 1.5, 4.0, 0.04);
                        // Layered second tone
                        playNote(ctx, musicBus, 40 + Math.random() * 20, 'triangle', 2.0, 3.0, 0.02);
                    }
                    
                    // ── LONELY PIANO MELODY — SH2 Promise/Laura style ──
                    vergeMelCooldown -= dt;
                    if (vergeMelActive) {
                        vergeMelTimer += dt;
                        if (vergeMelTimer > vergeMelInterval) {
                            vergeMelTimer = 0;
                            vergeMelInterval = (0.70 + Math.random() * 0.55 + wL * 0.12) / tempoScale;
                            
                            const phrase = vergeMelPhrases[vergeMelIdx % vergeMelPhrases.length];
                            const noteStr = phrase[vergeMelNoteIdx % phrase.length];
                            vergeMelNoteIdx++;
                            
                            if (noteStr) {
                                const freq = nf(noteStr);
                                playPiano(reverbBus, freq, 0.055 + Math.random() * 0.02, 3.0 + Math.random() * 1.5);
                                // When balanced, layer gentle harmonies and a soft pad for richer melody
                                if (wB > 0.55) {
                                    playPiano(reverbBus, freq * 1.5, 0.028 + Math.random() * 0.01, 2.5 + Math.random() * 0.8);
                                    if (Math.random() < 0.45) playPad(reverbBus, [freq * 0.5, freq, freq * 1.5], 0.018, 1.0, 4.5);
                                }
                            }
                            
                            if (vergeMelNoteIdx >= phrase.length) {
                                vergeMelNoteIdx = 0;
                                vergeMelIdx++;
                                vergeMelActive = false;
                                vergeMelCooldown = (9 + Math.random() * 11 + wL * 8 - wR * 5) / Math.max(0.85, tempoScale);
                            }
                        }
                    } else if (vergeMelCooldown <= 0 && !inHub && (extr > 0.10 || wR > 0.25 || wB > 0.55) && Math.random() < (0.45 + dens * 0.25 + wR * 0.15 + wB * 0.10 - wL * 0.10)) {
                        // Allow melody to spawn more often when Greyline is balanced (more tones)
                        vergeMelActive = true;
                        vergeMelTimer = 0;
                        vergeMelNoteIdx = 0;
                    }
                }
                
                // ═══════════════════════════════════
                // COMBAT MUSIC — Intensifying heartbeat + percussion
                // ═══════════════════════════════════
                combatIntensity = Math.max(0, combatIntensity - dt * 0.04);
                this.combatIntensity = combatIntensity;
                
                if (combatIntensity > 0.08) {
                    combatPulseTimer += dt;
                    const pulseRate = 0.55 - combatIntensity * 0.3; // Faster when intense
                    if (combatPulseTimer > pulseRate) {
                        combatPulseTimer = 0;
                        // Heartbeat thud
                        playNote(ctx, musicBus, 38, 'sine', 0.01, 0.2, 0.06 * combatIntensity);
                        // Second beat (slightly delayed, softer)
                        setTimeout(() => {
                            playNote(ctx, musicBus, 42, 'sine', 0.01, 0.15, 0.035 * combatIntensity);
                        }, 120);
                    }
                    
                    // High intensity: add tribal-ish percussion hits
                    if (combatIntensity > 0.4) {
                        combatDrumTimer += dt;
                        if (combatDrumTimer > 0.8 - combatIntensity * 0.3) {
                            combatDrumTimer = 0;
                            playNoiseBurst(0.05, 150, 'lowpass', 0.08 * combatIntensity);
                            if (Math.random() < 0.3) {
                                // Metallic accent
                                playNote(ctx, musicBus, 200 + Math.random() * 100, 'square', 0.002, 0.08, 0.03 * combatIntensity);
                            }
                        }
                    }
                }
                
                // ── GREYLINE EXTREME SOUND DESIGN ──
                if (extr > 0.5 && !inHub) {
                    // Tinnitus-like ringing at extremes
                    vergeFilt1.frequency.value = 200 + extr * 150 + Math.sin(t * 3) * 40;
                    if (Math.random() < dt * extr * 0.3) {
                        // Distorted whisper
                        playNoiseBurst(0.2, 800 + Math.random() * 600, 'bandpass', 0.02 * extr);
                    }
                }

                // aud.spikes -> random, short noisy spikes to create overload / chaos
                const spike = aud.spikes ?? 0;
                if (spike > 0.01 && Math.random() < dt * (1.2 + spike * 6 + dis * 0.8)) {
                    // random pitched spike or noise burst
                    if (Math.random() < 0.5) {
                        playNoiseBurst(0.06, 1200 + Math.random() * 4800, 'bandpass', 0.02 + spike * 0.07);
                    } else {
                        const freq = 300 + Math.random() * 2200;
                        playNote(ctx, sfxBus, freq, Math.random() > 0.5 ? 'square' : 'sawtooth', 0.002, 0.05 + spike * 0.08, 0.01 + spike * 0.02);
                    }
                }

                // Apply aud.mute -> attenuate SFX/music outputs smoothly and "simplify" music layers
                const gainSmooth = Math.max(0.02, smoothRate);
                const targetSfxGain = (audioSettings.sfx || 1.0) * sfxMuteFactor;
                sfxBus.gain.value += (targetSfxGain - sfxBus.gain.value) * gainSmooth;
                const targetMusicGain = (audioSettings.music || 1.0) * musicMuteFactor;
                musicBus.gain.value += (targetMusicGain - musicBus.gain.value) * gainSmooth;
                master.gain.value += (((audioSettings.master || 1.0) * (1 - audMute * 0.45)) - master.gain.value) * gainSmooth;
            }
        };
        
        audioStarted = true;
        console.log('[Audio] ✓ Game audio engine started — full layered music system');
    } catch(e) {
        console.warn('[Audio] Init failed:', e);
    }
}

// ============================================================
// INVENTORY SYSTEM — Burden-based, not slot-based
// Items are residue of fixation, not treasure
// ============================================================
const inventory = {
    items: [],
    maxBurdenCapacity: 100, // governed by player burden stat
    
    // Item types: 'implement', 'relic', 'remnant'
    
    getTotalWeight() {
        return this.items.reduce((s, i) => s + (i.weight || 1), 0);
    },
    
    canCarry(item) {
        return this.getTotalWeight() + (item.weight || 1) <= this.getCapacity();
    },
    
    getCapacity() {
        // Capacity linked to burden stat — higher burden tolerance = more you can carry
        return Math.floor(20 + psychStats.burden.value * 80);
    },
    
    add(item) {
        if (!this.canCarry(item)) return false;
        this.items.push({
            ...item,
            acquiredTime: TIME.elapsed,
            useCount: 0,
            relationship: 0, // builds with use, decays with neglect
        });
        return true;
    },
    
    remove(index) {
        if (index >= 0 && index < this.items.length) {
            return this.items.splice(index, 1)[0];
        }
        return null;
    },
    
    getByType(type) {
        return this.items.filter(i => i.type === type);
    },
    
    update(dt) {
        // Item relationships evolve
        for (const item of this.items) {
            // Relationship decays slowly
            item.relationship = Math.max(-1, item.relationship - dt * 0.001);
            
            // Over-relied items resist
            if (item.useCount > 10 && item.type === 'relic') {
                // Relic effects intensify then destabilize
                item.instability = (item.instability || 0) + dt * 0.002 * item.useCount;
            }
        }
        
        // Carrying weight affects game systems
        const weight = this.getTotalWeight();
        const capacity = this.getCapacity();
        const loadRatio = weight / Math.max(1, capacity);
        
        if (loadRatio > 0.7) {
            // Heavy load increases greyline instability
            greyline.drift += (Math.random() - 0.5) * loadRatio * 0.0005;
        }
    },
    
    updateUI() {
        const panel = document.getElementById('inventory-panel');
        if (!panel) return;
        
        // Rank display
        const rankEl = document.getElementById('inv-rank');
        if (rankEl) rankEl.textContent = `Rank ${progression.level} — ${progression.killCount} dispatched`;
        
        // Gold display in inventory
        const goldEl = document.getElementById('inv-gold-display');
        if (goldEl) {
            const coinUrl = ASSETS.iconGoldCoin || '';
            goldEl.innerHTML = coinUrl ? `<img src="${coinUrl}" alt="gold"> ${economy.gold} gold` : `${economy.gold} gold`;
        }
        
        // Burden bar
        const burdenFill = document.getElementById('inv-burden-fill');
        const burdenText = document.getElementById('inv-burden-text');
        const weight = this.getTotalWeight();
        const capacity = this.getCapacity();
        if (burdenFill) burdenFill.style.width = `${(weight / Math.max(1, capacity)) * 100}%`;
        if (burdenText) burdenText.textContent = `${weight}/${capacity}`;
        
        // Equipped items section
        const equippedContainer = document.getElementById('inv-equipped');
        if (equippedContainer) {
            const equippedItems = this.items.filter(i => i.equipped);
            const slotLabels = { weapon: 'WEAPON', armor: 'ARMOR', accessory1: 'RELIC I', accessory2: 'RELIC II' };
            const slots = ['weapon', 'armor', 'accessory1', 'accessory2'];
            
            equippedContainer.innerHTML = slots.map(slotKey => {
                const item = equippedItems.find(i => i.slot === slotKey);
                if (item) {
                    const imgUrl = item.imageKey && ASSETS[item.imageKey] ? ASSETS[item.imageKey] : '';
                    return `<div class="inv-equip-slot">
                        ${imgUrl ? `<img class="inv-equip-img" src="${imgUrl}" alt="${item.name}">` : `<span class="inv-item-icon">${item.icon || '◆'}</span>`}
                        <div class="inv-equip-info">
                            <div class="inv-equip-slot-label">${slotLabels[slotKey] || slotKey.toUpperCase()}</div>
                            <div class="inv-equip-name">${item.name}</div>
                            <div class="inv-equip-desc">${item.desc || ''}</div>
                        </div>
                    </div>`;
                } else {
                    return `<div class="inv-equip-slot">
                        <span class="inv-item-icon" style="opacity:0.2">◇</span>
                        <div class="inv-equip-info">
                            <div class="inv-equip-slot-label">${slotLabels[slotKey] || slotKey.toUpperCase()}</div>
                            <div class="inv-equip-name" style="opacity:0.3">empty</div>
                        </div>
                    </div>`;
                }
            }).join('');
        }
        
        // Unequipped items by type
        for (const type of ['implements', 'relics', 'remnants']) {
            const container = document.getElementById(`inv-${type}`);
            if (!container) continue;
            const singularType = type === 'implements' ? 'implement' : type === 'relics' ? 'relic' : 'remnant';
            const items = this.getByType(singularType).filter(i => !i.equipped);
            if (items.length === 0) {
                container.innerHTML = '<div class="inv-empty">nothing carried</div>';
            } else {
                container.innerHTML = items.map((item) => {
                    const imgUrl = item.imageKey && ASSETS[item.imageKey] ? ASSETS[item.imageKey] : '';
                    return `<div class="inv-item" data-index="${this.items.indexOf(item)}">
                        ${imgUrl ? `<img class="inv-item-img" src="${imgUrl}" alt="${item.name}">` : `<span class="inv-item-icon">${item.icon || '◆'}</span>`}
                        <div class="inv-item-info">
                            <div class="inv-item-name">${item.name}</div>
                            <div class="inv-item-desc">${item.desc || ''}</div>
                        </div>
                        <div class="inv-item-weight">${item.weight || 1}</div>
                    </div>`;
                }).join('');
            }
        }
    }
};

// ============================================================
// EQUIPMENT STAT BONUSES — Compute and apply bonuses from equipped items
// ============================================================
const equipBonuses = {
    damage: 1.0,
    speed: 1.0,
    range: 1.0,
    defense: 0,
    healthBonus: 0,
    staminaRegen: 0,
    lifesteal: 0,
    stun: 0,
    cooldownReduction: 0,
    healthRegen: 0,
    burdenResist: 0,
    burdenCapacity: 0,
    greylineStability: 0,
    insightBonus: 0,
    // Psych stat bonuses
    agency: 0, awareness: 0, precision: 0, adaptability: 0, integrity: 0,
};

function computeEquipBonuses() {
    // Reset all bonuses
    equipBonuses.damage = 1.0;
    equipBonuses.speed = 1.0;
    equipBonuses.range = 1.0;
    equipBonuses.defense = 0;
    equipBonuses.healthBonus = 0;
    equipBonuses.staminaRegen = 0;
    equipBonuses.lifesteal = 0;
    equipBonuses.stun = 0;
    equipBonuses.cooldownReduction = 0;
    equipBonuses.healthRegen = 0;
    equipBonuses.burdenResist = 0;
    equipBonuses.burdenCapacity = 0;
    equipBonuses.greylineStability = 0;
    equipBonuses.insightBonus = 0;
    equipBonuses.agency = 0;
    equipBonuses.awareness = 0;
    equipBonuses.precision = 0;
    equipBonuses.adaptability = 0;
    equipBonuses.integrity = 0;
    
    // Sum bonuses from all equipped items
    const equipped = inventory.items.filter(i => i.equipped);
    for (const item of equipped) {
        if (!item.stats) continue;
        const s = item.stats;
        if (s.damage !== undefined) equipBonuses.damage *= s.damage;
        if (s.speed !== undefined) equipBonuses.speed *= s.speed;
        if (s.range !== undefined) equipBonuses.range *= s.range;
        if (s.defense !== undefined) equipBonuses.defense += s.defense;
        if (s.healthBonus !== undefined) equipBonuses.healthBonus += s.healthBonus;
        if (s.staminaRegen !== undefined) equipBonuses.staminaRegen += s.staminaRegen;
        if (s.lifesteal !== undefined) equipBonuses.lifesteal += s.lifesteal;
        if (s.stun !== undefined) equipBonuses.stun += s.stun;
        if (s.cooldownReduction !== undefined) equipBonuses.cooldownReduction += s.cooldownReduction;
        if (s.healthRegen !== undefined) equipBonuses.healthRegen += s.healthRegen;
        if (s.burdenResist !== undefined) equipBonuses.burdenResist += s.burdenResist;
        if (s.burdenCapacity !== undefined) equipBonuses.burdenCapacity += s.burdenCapacity;
        if (s.greylineStability !== undefined) equipBonuses.greylineStability += s.greylineStability;
        if (s.insightBonus !== undefined) equipBonuses.insightBonus += s.insightBonus;
        // Psych stat bonuses
        if (s.agency !== undefined) equipBonuses.agency += s.agency;
        if (s.awareness !== undefined) equipBonuses.awareness += s.awareness;
        if (s.precision !== undefined) equipBonuses.precision += s.precision;
        if (s.adaptability !== undefined) equipBonuses.adaptability += s.adaptability;
        if (s.integrity !== undefined) equipBonuses.integrity += s.integrity;
    }
}

// Give the player starting items with proper image keys
function giveStartingItems() {
    inventory.add({
        type: 'implement',
        name: 'Husk Blade',
        desc: 'standard issue — it does what it does',
        icon: '🗡',
        imageKey: 'itemRapier',
        weight: 3,
        slot: 'weapon',
        effect: 'base_weapon',
        equipped: true,
        stats: { damage: 1.0, speed: 1.0 }
    });
    inventory.add({
        type: 'implement',
        name: 'Hunter\'s Trenchcoat',
        desc: 'black wool, oil-treated — it remembers the rain',
        icon: '🧥',
        imageKey: 'itemTrenchcoat',
        weight: 4,
        slot: 'armor',
        effect: 'base_armor',
        equipped: true,
        stats: { defense: 0.15, staminaRegen: 0.05 }
    });
    inventory.add({
        type: 'relic',
        name: 'Wire-Frame Glasses',
        desc: 'they don\'t correct your sight — they correct your seeing',
        icon: '👓',
        imageKey: 'itemGlasses',
        weight: 1,
        slot: 'accessory1',
        effect: 'awareness_boost',
        equipped: true,
        stats: { awareness: 0.08, precision: 0.05 }
    });
    inventory.add({
        type: 'relic',
        name: 'Purple Amulet',
        desc: 'hums faintly — the frequency matches your pulse',
        icon: '🔮',
        imageKey: 'itemAmulet',
        weight: 2,
        slot: 'accessory2',
        effect: 'greyline_stability',
        equipped: true,
        stats: { greylineStability: 0.1, burdenCapacity: 0.1 }
    });
    inventory.add({
        type: 'remnant',
        name: 'Faded Commission',
        desc: 'orders to clear the Verge — the ink is running',
        icon: '📜',
        weight: 1,
        effect: 'none'
    });
}

// ============================================================
// GOLD / ECONOMY SYSTEM
// ============================================================
const economy = {
    gold: 0,
    totalEarned: 0,
    
    addGold(amount) {
        this.gold += amount;
        this.totalEarned += amount;
        // Floating gold text
        particles.push({
            x: player.x, y: player.y,
            vx: (Math.random() - 0.5) * 0.4,
            vy: -1.0,
            type: 'insight_text',
            timer: 1.5,
            text: `+${amount} gold`,
            size: 11,
            color: 'rgba(240,210,100,0.9)'
        });
    },
    
    spend(amount) {
        if (this.gold >= amount) { this.gold -= amount; return true; }
        return false;
    }
};

// ============================================================
// LOOT TABLE — Items that can drop from enemies or appear in shop
// ============================================================
const LOOT_TABLE = {
    weapons: [
        { type: 'implement', name: 'Serrated Blade', desc: 'teeth along the edge — it wants to hurt', icon: '🗡', imageKey: 'itemSerratedBlade', weight: 4, slot: 'weapon', effect: 'serrated', sellValue: 35, buyValue: 80, rarity: 'common',
          stats: { damage: 1.3, speed: 0.85 } },
        { type: 'implement', name: 'Thorned Whip', desc: 'reach and cruelty — the Verge approves', icon: '🔗', imageKey: 'itemThornedWhip', weight: 3, slot: 'weapon', effect: 'thorned', sellValue: 45, buyValue: 100, rarity: 'uncommon',
          stats: { damage: 1.1, speed: 1.2, range: 1.3 } },
        { type: 'implement', name: 'Hollow Needle', desc: 'translucent and empty — it drinks what it pierces', icon: '📍', imageKey: 'itemHollowNeedle', weight: 1, slot: 'weapon', effect: 'hollow_needle', sellValue: 60, buyValue: 130, rarity: 'rare',
          stats: { damage: 0.9, speed: 1.5, lifesteal: 0.08 } },
        { type: 'implement', name: 'Weighted Chain', desc: 'industrial and blunt — momentum is meaning', icon: '⛓', imageKey: 'itemWeightedChain', weight: 7, slot: 'weapon', effect: 'weighted_chain', sellValue: 40, buyValue: 90, rarity: 'common',
          stats: { damage: 1.6, speed: 0.6, stun: 0.15 } },
    ],
    armors: [
        { type: 'implement', name: 'Ashen Mantle', desc: 'charred at the edges — it remembers fire', icon: '🧥', imageKey: 'itemAshenMantle', weight: 3, slot: 'armor', effect: 'ashen_mantle', sellValue: 30, buyValue: 75, rarity: 'common',
          stats: { defense: 0.12, burdenResist: 0.1 } },
        { type: 'implement', name: 'Flayed Vest', desc: 'cracked leather — it wears its scars openly', icon: '🦺', imageKey: 'itemFlayedVest', weight: 2, slot: 'armor', effect: 'flayed_vest', sellValue: 35, buyValue: 85, rarity: 'common',
          stats: { defense: 0.08, staminaRegen: 0.12 } },
        { type: 'implement', name: 'Ironweave Coat', desc: 'silver threads in black fabric — elegant weight', icon: '🧥', imageKey: 'itemIronweaveCoat', weight: 6, slot: 'armor', effect: 'ironweave', sellValue: 55, buyValue: 120, rarity: 'uncommon',
          stats: { defense: 0.22, speed: -0.2 } },
        { type: 'implement', name: 'Carapace Plate', desc: 'chitin and sinew — not armor, a second skin', icon: '🛡', imageKey: 'itemCarapacePlate', weight: 5, slot: 'armor', effect: 'carapace', sellValue: 70, buyValue: 150, rarity: 'rare',
          stats: { defense: 0.28, healthBonus: 15 } },
    ],
    accessories: [
        { type: 'relic', name: 'Echo Ring', desc: 'smoke inside the stone — someone else\'s memory', icon: '💍', imageKey: 'itemEchoRing', weight: 1, slot: 'accessory1', effect: 'echo_ring', sellValue: 40, buyValue: 90, rarity: 'uncommon',
          stats: { cooldownReduction: 0.1, awareness: 0.05 } },
        { type: 'relic', name: 'Marrow Pendant', desc: 'bone glows amber — warmth from something dead', icon: '📿', imageKey: 'itemMarrowPendant', weight: 2, slot: 'accessory1', effect: 'marrow_pendant', sellValue: 50, buyValue: 110, rarity: 'uncommon',
          stats: { healthRegen: 1.5, integrity: 0.06 } },
        { type: 'relic', name: 'Grief Locket', desc: 'light leaks from inside — whose grief?', icon: '🔷', imageKey: 'itemGriefLocket', weight: 1, slot: 'accessory2', effect: 'grief_locket', sellValue: 55, buyValue: 120, rarity: 'rare',
          stats: { greylineStability: 0.15, insightBonus: 0.1 } },
        { type: 'relic', name: 'Warden Sigil', desc: 'the pattern protects — but from what?', icon: '🔶', imageKey: 'itemWardenSigil', weight: 2, slot: 'accessory1', effect: 'warden_sigil', sellValue: 45, buyValue: 100, rarity: 'uncommon',
          stats: { defense: 0.08, burdenCapacity: 0.15 } },
        { type: 'relic', name: 'Spite Tooth', desc: 'cracked fang — malice as material', icon: '🦷', imageKey: 'itemSpiteTooth', weight: 2, slot: 'accessory2', effect: 'spite_tooth', sellValue: 35, buyValue: 80, rarity: 'common',
          stats: { damage: 0.12, agency: 0.06 } },
        { type: 'relic', name: 'Mirror Shard', desc: 'your reflection moves independently', icon: '🪞', imageKey: 'itemMirrorShard', weight: 1, slot: 'accessory2', effect: 'mirror_shard', sellValue: 65, buyValue: 140, rarity: 'rare',
          stats: { precision: 0.1, adaptability: 0.08 } },
        { type: 'relic', name: 'Hollow Eye', desc: 'golden iris — it sees what you won\'t', icon: '👁', imageKey: 'itemHollowEye', weight: 1, slot: 'accessory1', effect: 'hollow_eye', sellValue: 60, buyValue: 130, rarity: 'rare',
          stats: { awareness: 0.12, precision: 0.06 } },
        { type: 'relic', name: 'Binding Cord', desc: 'three materials braided tight — constraint as focus', icon: '🧶', imageKey: 'itemBindingCord', weight: 1, slot: 'accessory2', effect: 'binding_cord', sellValue: 30, buyValue: 70, rarity: 'common',
          stats: { staminaRegen: 0.08, cooldownReduction: 0.05 } },
    ],
    remnants: [
        { type: 'remnant', name: 'Ashen Journal', desc: 'half the words are burned — half is enough', icon: '📖', imageKey: 'itemAshenJournal', weight: 2, effect: 'ashen_journal', sellValue: 15, rarity: 'common',
          stats: { insightBonus: 0.08 } },
        { type: 'remnant', name: 'Husk Fragment', desc: 'solidified dark matter — it hums when held', icon: '💎', imageKey: 'itemHuskFragment', weight: 3, effect: 'husk_fragment', sellValue: 25, rarity: 'uncommon',
          stats: { burdenCapacity: 0.1 } },
        { type: 'remnant', name: 'Faded Photograph', desc: 'faces almost gone — recognition hurts more', icon: '🖼', imageKey: 'itemFadedPhoto', weight: 1, effect: 'faded_photo', sellValue: 10, rarity: 'common',
          stats: { greylineStability: 0.05 } },
        { type: 'remnant', name: 'Corroded Compass', desc: 'needle points wrong — or does it?', icon: '🧭', imageKey: 'itemCorrodedCompass', weight: 2, effect: 'corroded_compass', sellValue: 20, rarity: 'common',
          stats: { awareness: 0.04 } },
    ],
    consumables: [
        { type: 'consumable', name: 'Health Potion', desc: 'Restores 30 Integrity', icon: '⚗️', imageKey: 'uiHealthOrb', effect: 'heal', healAmount: 30, sellValue: 5, buyValue: 20, rarity: 'common' }
    ],
};

// Flatten all droppable items for random access
const ALL_LOOT_ITEMS = [
    ...LOOT_TABLE.weapons,
    ...LOOT_TABLE.armors,
    ...LOOT_TABLE.accessories,
    ...LOOT_TABLE.remnants,
    ...LOOT_TABLE.consumables,
];

// Enemy drop tables — what types of drops each enemy gives
const ENEMY_DROP_CONFIG = {
    lingering:   { goldMin: 3,  goldMax: 8,  lootChance: 0.12, healthChance: 0.25, rarity: ['common'] },
    watchful:    { goldMin: 5,  goldMax: 12, lootChance: 0.18, healthChance: 0.20, rarity: ['common', 'uncommon'] },
    huddled:     { goldMin: 2,  goldMax: 5,  lootChance: 0.08, healthChance: 0.30, rarity: ['common'] },
    rehearsed:   { goldMin: 8,  goldMax: 18, lootChance: 0.22, healthChance: 0.18, rarity: ['common', 'uncommon', 'rare'] },
    burdened:    { goldMin: 10, goldMax: 22, lootChance: 0.25, healthChance: 0.15, rarity: ['common', 'uncommon', 'rare'] },
    drifting:    { goldMin: 4,  goldMax: 10, lootChance: 0.14, healthChance: 0.22, rarity: ['common', 'uncommon'] },
    deferred:    { goldMin: 12, goldMax: 28, lootChance: 0.28, healthChance: 0.12, rarity: ['uncommon', 'rare'] },
    remembered:  { goldMin: 15, goldMax: 35, lootChance: 0.32, healthChance: 0.10, rarity: ['uncommon', 'rare'] },
};

// ============================================================
// WORLD DROPS — Items, health orbs, and gold on the ground
// ============================================================
let worldDrops = [];

function spawnWorldDrop(x, y, dropType, data) {
    worldDrops.push({
        x: x + (Math.random() - 0.5) * 1.5,
        y: y + (Math.random() - 0.5) * 1.5,
        type: dropType, // 'item', 'health', 'gold'
        data: data,     // item object for 'item', amount for 'health'/'gold'
        timer: 0,
        bobPhase: Math.random() * Math.PI * 2,
        collected: false,
        despawnTimer: 60, // disappears after 60 seconds
    });
}

function spawnEnemyDrops(enemyType, x, y) {
    const config = ENEMY_DROP_CONFIG[enemyType];
    if (!config) return;
    
    // Gold always drops
    const goldAmount = config.goldMin + Math.floor(Math.random() * (config.goldMax - config.goldMin + 1));
    spawnWorldDrop(x, y, 'gold', goldAmount);
    
    // Health drop chance
    if (Math.random() < config.healthChance) {
        const healAmount = 10 + Math.floor(Math.random() * 15);
        spawnWorldDrop(x, y, 'health', healAmount);
    }
    
    // Item loot drop chance
    if (Math.random() < config.lootChance) {
        // Filter by allowed rarity
        const eligible = ALL_LOOT_ITEMS.filter(i => config.rarity.includes(i.rarity));
        if (eligible.length > 0) {
            const item = { ...eligible[Math.floor(Math.random() * eligible.length)] };
            spawnWorldDrop(x, y, 'item', item);
        }
    }
}

function updateWorldDrops(dt) {
    for (const drop of worldDrops) {
        drop.timer += dt;
        drop.despawnTimer -= dt;
        
        // Auto-collect if player walks over
        if (!drop.collected) {
            const dx = player.x - drop.x;
            const dy = player.y - drop.y;
            const distSq = dx * dx + dy * dy;
            const pickupRadius = drop.type === 'gold' ? 2.0 : 1.5;

            if (distSq < pickupRadius * pickupRadius) {
                drop.collected = true;
                if (drop.type === 'gold') {
                    economy.addGold(drop.data);
                    playPickupSound('gold');
                } else if (drop.type === 'health') {
                    player.health = Math.min(player.maxHealth, player.health + drop.data);
                    // Healing gives a small restraint nudge (potions / health pickups encourage steadiness)
                    try { greyline.push(-1, 0.008); } catch (e) { /* defensive - greyline may not be ready in some early states */ }
                    particles.push({ x: player.x, y: player.y, vx: 0, vy: -1.0, type: 'insight_text', timer: 1.2, text: `+${drop.data} HP`, size: 11, color: 'rgba(130,200,100,0.9)' });
                    playPickupSound('health');
                } else if (drop.type === 'item') {
                    if (inventory.canCarry(drop.data)) {
                        inventory.add(drop.data);
                        particles.push({ x: player.x, y: player.y, vx: 0, vy: -1.2, type: 'insight_text', timer: 2.0, text: drop.data.name, size: 13, color: drop.data.rarity === 'rare' ? 'rgba(180,140,255,0.95)' : drop.data.rarity === 'uncommon' ? 'rgba(140,200,255,0.9)' : 'rgba(200,185,155,0.85)' });
                        playPickupSound('item');
                    } else {
                        drop.collected = false; // Can't carry, leave it
                    }
                }
            }
        }
    }
    // Remove collected or despawned drops
    worldDrops = worldDrops.filter(d => !d.collected && d.despawnTimer > 0);
}

function playPickupSound(type) {
    if (!audioEngine || !audioEngine.ctx) return;
    const ctx = audioEngine.ctx;
    const now = ctx.currentTime;
    const dest = audioEngine.sfxBus || ctx.destination;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    if (type === 'gold') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);
        osc.frequency.exponentialRampToValueAtTime(1600, now + 0.12);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(gain); gain.connect(dest); osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'health') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(660, now + 0.15);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain); gain.connect(dest); osc.start(now); osc.stop(now + 0.25);
    } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523, now);
        osc.frequency.exponentialRampToValueAtTime(784, now + 0.1);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain); gain.connect(dest); osc.start(now); osc.stop(now + 0.3);
        // Second chime
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1047, now + 0.08);
        gain2.gain.setValueAtTime(0.08, now + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc2.connect(gain2); gain2.connect(dest); osc2.start(now + 0.08); osc2.stop(now + 0.35);
    }
}

// ============================================================
// WORLD DROP RENDERING — Draw gold, health, and items on the ground
// ============================================================
function drawWorldDrop(ctx, sx, sy, drop) {
    const t = TIME.elapsed;
    const bob = Math.sin(t * 3 + drop.bobPhase) * 3;
    const fadeIn = Math.min(1, drop.timer * 3);
    const fadeOut = drop.despawnTimer < 5 ? drop.despawnTimer / 5 : 1;
    const alpha = fadeIn * fadeOut;
    
    ctx.globalAlpha = alpha;
    
    if (drop.type === 'gold') {
        // Gold coin — draw gold coin image or golden circle
        const goldImg = loadedImages.iconGoldCoin;
        const size = 16;
        
        // Glow
        ctx.fillStyle = `rgba(240,210,80,${0.15 + Math.sin(t * 4 + drop.bobPhase) * 0.08})`;
        ctx.beginPath();
        ctx.arc(sx, sy - 8 + bob, 12, 0, Math.PI * 2);
        ctx.fill();
        
        if (goldImg) {
            ctx.drawImage(goldImg, sx - size / 2, sy - size + bob, size, size);
        } else {
            // Fallback golden circle
            ctx.fillStyle = '#d4a830';
            ctx.beginPath();
            ctx.arc(sx, sy - 8 + bob, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#a88520';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        
        // Gold amount text
        if (drop.data > 5) {
            ctx.font = 'bold 8px Georgia, serif';
            ctx.fillStyle = 'rgba(240,215,120,0.9)';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 2;
            ctx.fillText(`${drop.data}`, sx, sy - 16 + bob);
            ctx.shadowBlur = 0;
        }
    } else if (drop.type === 'health') {
        // Health orb — green/red pulsing glow
        const pulseR = 6 + Math.sin(t * 5 + drop.bobPhase) * 1.5;
        
        // Outer glow
        const gGrad = ctx.createRadialGradient(sx, sy - 8 + bob, 0, sx, sy - 8 + bob, pulseR * 2);
        gGrad.addColorStop(0, 'rgba(100,200,80,0.25)');
        gGrad.addColorStop(1, 'rgba(60,140,50,0)');
        ctx.fillStyle = gGrad;
        ctx.beginPath();
        ctx.arc(sx, sy - 8 + bob, pulseR * 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Core
        const cGrad = ctx.createRadialGradient(sx, sy - 8 + bob, 0, sx, sy - 8 + bob, pulseR);
        cGrad.addColorStop(0, 'rgba(150,240,120,0.9)');
        cGrad.addColorStop(0.6, 'rgba(80,180,60,0.7)');
        cGrad.addColorStop(1, 'rgba(40,120,30,0.3)');
        ctx.fillStyle = cGrad;
        ctx.beginPath();
        ctx.arc(sx, sy - 8 + bob, pulseR, 0, Math.PI * 2);
        ctx.fill();
        
        // Cross
        ctx.fillStyle = 'rgba(200,255,180,0.8)';
        ctx.fillRect(sx - 1, sy - 12 + bob, 2, 8);
        ctx.fillRect(sx - 3, sy - 10 + bob, 6, 2);
    } else if (drop.type === 'item') {
        // Item drop — draw item image with glow based on rarity
        const item = drop.data;
        let glowColor = 'rgba(180,165,130,0.2)'; // common
        if (item.rarity === 'uncommon') glowColor = 'rgba(100,180,240,0.25)';
        if (item.rarity === 'rare') glowColor = 'rgba(160,120,240,0.3)';
        
        // Rarity glow
        const glowR = 14 + Math.sin(t * 2.5 + drop.bobPhase) * 3;
        const iGrad = ctx.createRadialGradient(sx, sy - 10 + bob, 0, sx, sy - 10 + bob, glowR);
        iGrad.addColorStop(0, glowColor);
        iGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = iGrad;
        ctx.beginPath();
        ctx.arc(sx, sy - 10 + bob, glowR, 0, Math.PI * 2);
        ctx.fill();
        
        // Item image
        const imgKey = item.imageKey;
        const itemImg = imgKey ? loadedImages[imgKey] : null;
        const iSize = 20;
        if (itemImg) {
            ctx.drawImage(itemImg, sx - iSize / 2, sy - iSize + bob, iSize, iSize);
        } else {
            // Fallback
            ctx.fillStyle = item.rarity === 'rare' ? '#a080e0' : item.rarity === 'uncommon' ? '#70b0d0' : '#b0a080';
            ctx.fillRect(sx - 5, sy - 14 + bob, 10, 10);
        }
        
        // Item name text (only show briefly)
        if (drop.timer < 4) {
            const nameAlpha = drop.timer < 2 ? Math.min(1, drop.timer) : Math.max(0, 1 - (drop.timer - 2) / 2);
            ctx.globalAlpha = alpha * nameAlpha;
            ctx.font = 'bold 8px Georgia, serif';
            ctx.fillStyle = item.rarity === 'rare' ? 'rgba(180,150,255,0.95)' : item.rarity === 'uncommon' ? 'rgba(140,200,255,0.9)' : 'rgba(200,185,155,0.85)';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0,0,0,0.9)';
            ctx.shadowBlur = 3;
            ctx.fillText(item.name, sx, sy - 22 + bob);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = alpha;
        }
    }
    
    // Shadow on ground
    ctx.globalAlpha = alpha * 0.3;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 2, 6, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.globalAlpha = 1;
}

// ============================================================
// SHOP SYSTEM — Sable the Mender becomes the shopkeeper
// ============================================================
let shopOpen = false;
let shopInventory = [];
let shopLastRefresh = 0;

function refreshShopInventory() {
    shopInventory = [];
    // Stock 6 random items
    const pool = [...ALL_LOOT_ITEMS];
    for (let i = 0; i < 6; i++) {
        if (pool.length === 0) break;
        const idx = Math.floor(Math.random() * pool.length);
        shopInventory.push({ ...pool[idx], id: Math.random() });
        pool.splice(idx, 1);
    }
    shopLastRefresh = TIME.elapsed;
}

function openShop() {
    shopOpen = true;
    // Refresh shop every 5 minutes or first open
    if (shopInventory.length === 0 || TIME.elapsed - shopLastRefresh > 300) {
        refreshShopInventory();
    }
    updateShopUI();
    document.getElementById('shop-panel')?.classList.add('visible');
}

function closeShop() {
    shopOpen = false;
    document.getElementById('shop-panel')?.classList.remove('visible');
}

function updateShopUI() {
    const panel = document.getElementById('shop-panel');
    if (!panel) return;
    
    const goldEl = document.getElementById('shop-gold');
    if (goldEl) goldEl.textContent = `${economy.gold} gold`;
    
    // Shop items for sale
    const buyContainer = document.getElementById('shop-buy-items');
    if (buyContainer) {
        buyContainer.innerHTML = shopInventory.map((item, i) => {
            const imgUrl = item.imageKey && ASSETS[item.imageKey] ? ASSETS[item.imageKey] : '';
            const canAfford = economy.gold >= (item.buyValue || 50);
            const rarityClass = item.rarity === 'rare' ? 'shop-rare' : item.rarity === 'uncommon' ? 'shop-uncommon' : '';
            const statText = item.stats ? Object.entries(item.stats).map(([k, v]) => `${k}: ${v > 0 ? '+' : ''}${typeof v === 'number' && v < 1 && v > -1 ? Math.round(v * 100) + '%' : v}`).join(', ') : '';
            return `<div class="shop-item ${rarityClass}">
                ${imgUrl ? `<img class="shop-item-img" src="${imgUrl}" alt="${item.name}">` : `<span class="shop-item-icon">${item.icon || '◆'}</span>`}
                <div class="shop-item-info">
                    <div class="shop-item-name">${item.name}</div>
                    <div class="shop-item-desc">${item.desc || ''}</div>
                    <div class="shop-item-stats">${statText}</div>
                </div>
                <div class="shop-item-action">
                    <div class="shop-item-price">${item.buyValue || 50}g</div>
                    <button class="shop-btn ${canAfford ? '' : 'disabled'}" onclick="handleShopBuy(${i})">BUY</button>
                </div>
            </div>`;
        }).join('') || '<div class="shop-empty">nothing in stock</div>';
    }
    
    // Player items to sell
    const sellContainer = document.getElementById('shop-sell-items');
    if (sellContainer) {
        const sellable = inventory.items.filter(i => !i.equipped && i.sellValue);
        sellContainer.innerHTML = sellable.map(item => {
            const imgUrl = item.imageKey && ASSETS[item.imageKey] ? ASSETS[item.imageKey] : '';
            const idx = inventory.items.indexOf(item);
            return `<div class="shop-item">
                ${imgUrl ? `<img class="shop-item-img" src="${imgUrl}" alt="${item.name}">` : `<span class="shop-item-icon">${item.icon || '◆'}</span>`}
                <div class="shop-item-info">
                    <div class="shop-item-name">${item.name}</div>
                    <div class="shop-item-desc">${item.desc || ''}</div>
                </div>
                <div class="shop-item-action">
                    <div class="shop-item-price">${item.sellValue || 5}g</div>
                    <button class="shop-btn sell-btn" onclick="handleShopSell(${idx})">SELL</button>
                </div>
            </div>`;
        }).join('') || '<div class="shop-empty">nothing to sell</div>';
    }
}

window.handleShopBuy = function(shopIdx) {
    if (shopIdx < 0 || shopIdx >= shopInventory.length) return;
    const item = shopInventory[shopIdx];
    const cost = item.buyValue || 50;
    if (!economy.spend(cost)) return;

    // Consumable (health potion) handling
    if (item.type === 'consumable' && item.effect === 'heal') {
        if (player.potions >= player.maxPotions) {
            economy.addGold(cost); // refund
            return;
        }
        player.potions = Math.min(player.maxPotions, player.potions + 1);
        shopInventory.splice(shopIdx, 1);
        updateShopUI();
        playPickupSound('item');
        return;
    }

    if (!inventory.canCarry(item)) {
        economy.addGold(cost); // Refund
        return;
    }
    const bought = { ...item };
    delete bought.id;
    bought.equipped = false;
    inventory.add(bought);
    shopInventory.splice(shopIdx, 1);
    updateShopUI();
    playPickupSound('item');
};

window.handleShopSell = function(invIdx) {
    if (invIdx < 0 || invIdx >= inventory.items.length) return;
    const item = inventory.items[invIdx];
    if (item.equipped) return;
    const value = item.sellValue || 5;
    inventory.remove(invIdx);
    economy.addGold(value);
    updateShopUI();
    playPickupSound('gold');
};

// Quick-buy handler for Health Potions in Sable's shop
window.buyHealthPotion = function() {
    const cost = 20;
    if (player.potions >= player.maxPotions) return;
    if (!economy.spend(cost)) return;
    player.potions = Math.min(player.maxPotions, player.potions + 1);
    updateShopUI();
    playPickupSound('item');
};

// ============================================================
// PROGRESSION SYSTEM — Insight, not experience
// You don't "level up." You develop insight through engagement.
// The system rewards varied play, not grinding.
// ============================================================
const progression = {

    insightTotal: 0,        // Lifetime insight earned (display only)
    insightCurrent: 0,      // Current unspent insight
    level: 1,               // Current Husk Hunter rank
    insightToNext: 50,      // Insight needed for next level
    killCount: 0,           // Total enemies dispatched
    skillPoints: 0,         // Unspent skill upgrade points
    
    // Skill upgrade tiers — each skill can be upgraded 3 times
    skillUpgrades: {
        predatory:    { level: 0, maxLevel: 3, name: 'Predatory Motion',     desc: ['Faster dash', 'Phase through enemies', 'Shadow trail damages'] },
        snare:        { level: 0, maxLevel: 3, name: 'Adaptive Snare',       desc: ['Wider trap radius', 'Slows enemies longer', 'Detonates on expire'] },
        reclaim:      { level: 0, maxLevel: 3, name: 'Reclamation',          desc: ['Larger zone', 'Heals in zone', 'Zone persists longer'] },
        attune:       { level: 0, maxLevel: 3, name: 'Attunement',           desc: ['Longer duration', 'Reveals weaknesses', 'Pulse damages nearby'] },
        burdenShift:  { level: 0, maxLevel: 3, name: 'Burden Shift',         desc: ['More damage absorbed', 'Wider blast radius', 'Stuns on release'] },
        shadow:       { level: 0, maxLevel: 3, name: 'Shadow Acknowledgement', desc: ['Longer duration', 'Shadow tendrils', 'Integration heals'] },
    },
    
    // Passive upgrades
    passiveUpgrades: {
        vitality:     { level: 0, maxLevel: 5, name: 'Vitality',     desc: '+10 max health per level',       effect: () => { player.maxHealth = 100 + progression.passiveUpgrades.vitality.level * 10; } },
        endurance:    { level: 0, maxLevel: 5, name: 'Endurance',    desc: '+8 max stamina per level',       effect: () => { player.maxStamina = 100 + progression.passiveUpgrades.endurance.level * 8; } },
        resilience:   { level: 0, maxLevel: 5, name: 'Resilience',   desc: '+3% damage reduction per level', effect: () => {} },
        swiftness:    { level: 0, maxLevel: 5, name: 'Swiftness',    desc: '+0.15 move speed per level',     effect: () => { player.speed = 3.5 + progression.passiveUpgrades.swiftness.level * 0.15; } },
    },
    
    // Insight reward values by enemy type — harder enemies give more
    insightValues: {
        lingering: 8,
        watchful: 12,
        huddled: 6,
        rehearsed: 15,
        burdened: 18,
        drifting: 10,
        deferred: 22,
        remembered: 25,
    },
    
    // Bonus multiplier for varied play
    varietyBonus: 1.0,
    lastKillType: null,
    consecutiveSameType: 0,
    
    grantInsight(enemyType) {
        let base = this.insightValues[enemyType] || 10;
        
        // Variety bonus — killing different types rewards more
        if (enemyType === this.lastKillType) {
            this.consecutiveSameType++;
            // Diminishing returns for farming same type
            this.varietyBonus = Math.max(0.3, 1.0 - this.consecutiveSameType * 0.15);
        } else {
            this.consecutiveSameType = 0;
            this.varietyBonus = Math.min(1.5, this.varietyBonus + 0.2);
        }
        this.lastKillType = enemyType;
        
        // Greyline balance bonus — being near center rewards insight
        const greyDist = greyline.getDistance();
        const balanceBonus = greyDist < 0.15 ? 1.3 : (greyDist < 0.3 ? 1.1 : 1.0);
        
        const equipInsightMod = 1 + (equipBonuses.insightBonus || 0);
        const total = Math.floor(base * this.varietyBonus * balanceBonus * equipInsightMod);
        this.insightCurrent += total;
        this.insightTotal += total;
        this.killCount++;
        
        // Check for level up
        while (this.insightCurrent >= this.insightToNext) {
            this.levelUp();
        }
        
        // Floating insight text particle
        particles.push({
            x: player.x, y: player.y,
            vx: (Math.random() - 0.5) * 0.3,
            vy: -1.2,
            type: 'insight_text',
            timer: 1.8,
            text: `+${total}`,
            size: total > 15 ? 14 : 11,
            color: total > 15 ? 'rgba(220,195,140,0.9)' : 'rgba(180,160,120,0.7)'
        });
        
        return total;
    },
    
    levelUp() {
        this.insightCurrent -= this.insightToNext;
        this.level++;
        this.skillPoints++;
        // Insight curve — each level requires more
        this.insightToNext = Math.floor(50 * Math.pow(1.35, this.level - 1));
        
        // Level up VFX
        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2;
            particles.push({
                x: player.x, y: player.y,
                vx: Math.cos(angle) * (1.5 + Math.random()),
                vy: Math.sin(angle) * (1 + Math.random()) - 0.5,
                type: 'level_up',
                timer: 1.5 + Math.random() * 0.5,
                size: 3 + Math.random() * 3
            });
        }
        
        // Flash notification
        particles.push({
            x: player.x, y: player.y,
            vx: 0, vy: -1.8,
            type: 'insight_text',
            timer: 2.5,
            text: `RANK ${this.level}`,
            size: 16,
            color: 'rgba(240,210,150,0.95)'
        });
        
        // Level up sound
        if (typeof playLevelUpSound === 'function') playLevelUpSound();
    },
    
    upgradeSkill(skillKey) {
        const skill = this.skillUpgrades[skillKey];
        if (!skill || skill.level >= skill.maxLevel || this.skillPoints <= 0) return false;
        skill.level++;
        this.skillPoints--;
        // Apply upgrade effects
        this.applySkillUpgrade(skillKey, skill.level);
        return true;
    },
    
    upgradePassive(passiveKey) {
        const passive = this.passiveUpgrades[passiveKey];
        if (!passive || passive.level >= passive.maxLevel || this.skillPoints <= 0) return false;
        passive.level++;
        this.skillPoints--;
        passive.effect();
        return true;
    },
    
    applySkillUpgrade(key, level) {
        // Skill upgrade effects are checked dynamically in skill execution
        // This just ensures the level is set
    },
    
    getSkillLevel(key) {
        return this.skillUpgrades[key]?.level || 0;
    },
    
    getXpPercent() {
        return this.insightCurrent / Math.max(1, this.insightToNext);
    }
};
const xpSystem = progression;
// ============================================================
// CANVAS & CONTEXT
// ============================================================
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
// Developer VFX debug toggle (press F2 to show grain thumbnail & knobs)
let DEV_VFX_DEBUG = false;
let DEV_GREY_DEBUG = false; // press F3 to toggle greyline telemetry / dev readout
let disableBlur = false; // F5 toggles global blur off/on

document.addEventListener('keydown', (e) => {
    if (e.key === 'F2') { DEV_VFX_DEBUG = !DEV_VFX_DEBUG; console.info('[VFX DEBUG] DEV_VFX_DEBUG =', DEV_VFX_DEBUG); }
    if (e.key === 'F3') { DEV_GREY_DEBUG = !DEV_GREY_DEBUG; console.info('[GREY DEBUG] DEV_GREY_DEBUG =', DEV_GREY_DEBUG); }
    if (e.key === 'F5') { disableBlur = !disableBlur; console.info('[VFX] disableBlur =', disableBlur); }
});

// --- Post-process buffers for perceptual ghosting ---
const lastFrameCanvas = document.createElement('canvas');
const lastFrameCtx = lastFrameCanvas.getContext('2d');
// --- Grain/noise buffer (cheap, reusable) ---
const grainCanvas = document.createElement('canvas');
const grainCtx = grainCanvas.getContext('2d');
let _grainTick = 0;
function ensureGrainBuffer() {
    // small tileable noise texture
    if (grainCanvas.width !== 256 || grainCanvas.height !== 256) {
        grainCanvas.width = 256;
        grainCanvas.height = 256;
    }
    // refresh at low frequency to avoid shimmer fatigue
    _grainTick++;
    if (_grainTick % 4 !== 0) return;
    const img = grainCtx.createImageData(grainCanvas.width, grainCanvas.height);
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        data[i] = v; data[i+1] = v; data[i+2] = v;
        data[i+3] = 255;
    }
    grainCtx.putImageData(img, 0, 0);
    // mark refresh so we can verify population (and optionally log)
    grainCanvas._lastPopulated = (performance && performance.now) ? performance.now() : Date.now();
    if (typeof DEV_VFX_DEBUG !== 'undefined' && DEV_VFX_DEBUG) console.debug('[VFX] grainCanvas refreshed', grainCanvas._lastPopulated);

}
function ensurePostBuffers() {
    if (lastFrameCanvas.width !== canvas.width || lastFrameCanvas.height !== canvas.height) {
        lastFrameCanvas.width = canvas.width;
        lastFrameCanvas.height = canvas.height;
        lastFrameCtx.clearRect(0,0,lastFrameCanvas.width,lastFrameCanvas.height);
    }
    ensureGrainBuffer();
}

// Helper: is the player currently inside any haze pool?
function isPlayerInHaze() {
    if (!world || !world.hazePools || !player) return false;
    for (const p of world.hazePools) {
        const dx = player.x - p.x, dy = player.y - p.y;
        if (dx*dx + dy*dy < (p.radius || 0) * (p.radius || 0)) return true;
    }
    return false;
}

// Helper: rounded rectangle path (does not fill/stroke by itself)
function roundRect(ctx, x, y, width, height, radius) {
    if (radius === undefined) radius = 6;
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
}


// Fixed internal render resolution (avoid using full-monitor size — improves performance)
const FIXED_CANVAS_W = 1280;
const FIXED_CANVAS_H = 720;

// Optional developer override to simulate a particular viewport size (useful for QA)
window.__FORCE_VIEWPORT = null;
function getViewportDims() {
    if (window.__FORCE_VIEWPORT && window.__FORCE_VIEWPORT.w && window.__FORCE_VIEWPORT.h) return { w: window.__FORCE_VIEWPORT.w, h: window.__FORCE_VIEWPORT.h };
    return { w: window.innerWidth, h: window.innerHeight };
}

// UI debug overlay (populated by resize()/debug button)
window._visibleCanvas = { left: 0, top: 0, scaledW: FIXED_CANVAS_W, scaledH: FIXED_CANVAS_H, scale: 1.0, visibleTop: 0, visibleBottom: FIXED_CANVAS_H };
function applyForcedViewport(w, h) { window.__FORCE_VIEWPORT = { w: w, h: h }; resize(); }
function clearForcedViewport() { window.__FORCE_VIEWPORT = null; resize(); }
function toggleForcedViewport1920() { if (window.__FORCE_VIEWPORT) clearForcedViewport(); else applyForcedViewport(1920, 1080); updateUiDebugOverlay(); }

function resize() {
    const dims = getViewportDims();
    const logical = viewportSize(dims.w, dims.h);
    canvas.width = logical.w;
    canvas.height = logical.h;
    const scale = dims.w / canvas.width;
    const scaledW = dims.w;
    const scaledH = dims.h;

    // Apply scaled dimensions so the canvas fills the viewport horizontally when possible
    canvas.style.width = scaledW + 'px';
    canvas.style.height = scaledH + 'px';
    canvas.style.position = 'fixed';
    canvas.style.left = '50%';
    canvas.style.top = '50%';
    canvas.style.transform = 'translate(-50%, -50%)';
    // Keep the game surface within the viewport.
    canvas.style.maxWidth = 'none';
    canvas.style.maxHeight = 'none';
    canvas.style.imageRendering = 'auto';

    // Keep document scroll disabled to avoid accidental scrollbars
    document.body.style.overflow = 'hidden';

    // Keep the UI overlay covering the full viewport so elements aren't clipped
    try {
        const ui = document.getElementById('ui-overlay');
        if (ui) {
            ui.style.position = 'fixed';
            ui.style.left = '0px';
            ui.style.top = '0px';
            ui.style.width = '100%';
            ui.style.height = '100%';
            // allow clicks on overlay elements (title screen buttons, etc.)
            ui.style.pointerEvents = 'auto';
        }
        const titleScreen = document.getElementById('title-screen');
        if (titleScreen) {
            // Ensure title-screen children still cover viewport
            titleScreen.style.left = '0';
            titleScreen.style.top = '0';
            titleScreen.style.width = '100%';
            titleScreen.style.height = '100%';
            titleScreen.style.zIndex = 1000; // lift above canvas
            titleScreen.style.pointerEvents = 'auto';
        }
        // also ensure title background canvas doesn't intercept clicks
        const tc = document.getElementById('title-bg-canvas');
        if (tc) {
            tc.style.pointerEvents = 'none';
            tc.style.zIndex = 0;
        }

        // Record the canvas rectangle for HUD alignment/debug
        const left = Math.round((dims.w - scaledW) / 2);
        const top = Math.round((dims.h - scaledH) / 2);
        const visibleCanvasH = Math.round(dims.h / scale);
        const visibleTop = Math.round((canvas.height - visibleCanvasH) / 2);
        const visibleBottom = Math.round(visibleTop + visibleCanvasH);
        window._visibleCanvas = { left, top, scaledW, scaledH, scale, visibleTop, visibleBottom };

        // Reposition DOM HUD elements inside the current canvas.
        try {
            const toViewportY = (internalY) => Math.round(top + (internalY / canvas.height) * scaledH);
            const toViewportX = (internalX) => Math.round(left + (internalX / canvas.width) * scaledW);

            // Skill bar -> center-bottom of visible canvas
            const skillBar = document.getElementById('skills-bar');
            if (skillBar) {
                const skillBarInternalY = canvas.height - 76; // same internal offset used by canvas HUD
                const skillBarTopPx = toViewportY(skillBarInternalY);
                const skillBarLeftPx = toViewportX(canvas.width / 2);
                skillBar.style.position = 'fixed';
                skillBar.style.left = skillBarLeftPx + 'px';
                skillBar.style.top = skillBarTopPx + 'px';
                skillBar.style.transform = 'translate(-50%, 0)';
                skillBar.style.pointerEvents = 'auto';
                skillBar.style.zIndex = 1200;
            }

            // Area name -> canvas center
            const areaName = document.getElementById('area-name');
            if (areaName) {
                const centerY = toViewportY(canvas.height / 2) - Math.round(parseFloat(getComputedStyle(areaName).fontSize || 28) / 2);
                areaName.style.top = centerY + 'px';
                areaName.style.left = toViewportX(canvas.width / 2) + 'px';
                areaName.style.transform = 'translate(-50%, -50%)';
            }

            // Dialogue and interact prompts -> margin from visible bottom
            const dialog = document.getElementById('dialogue-box');
            if (dialog) dialog.style.bottom = Math.max(12, (window.innerHeight - (top + scaledH)) + 80) + 'px';
            const interact = document.getElementById('interact-prompt');
            if (interact) interact.style.bottom = Math.max(12, (window.innerHeight - (top + scaledH)) + 130) + 'px';
        } catch (e) { /* ignore DOM layout issues during resize */ }

        updateUiDebugOverlay();
    } catch (e) { /* ignore in non-DOM contexts */ }
}
window.addEventListener('resize', resize);
resize();

// ============================================================
// ISOMETRIC HELPERS
// ============================================================
const ISO_ANGLE = Math.PI / 6;
const TILE_W = 64;
const TILE_H = 32;

function worldToScreen(wx, wy) {
    const sx = (wx - wy) * (TILE_W / 2);
    const sy = (wx + wy) * (TILE_H / 2);
    return { x: sx, y: sy };
}

function screenToWorld(sx, sy) {
    const wx = (sx / (TILE_W / 2) + sy / (TILE_H / 2)) / 2;
    const wy = (sy / (TILE_H / 2) - sx / (TILE_W / 2)) / 2;
    return { x: wx, y: wy };
}

// ── 8-DIRECTIONAL HELPERS ──
// Dir index: 0=N, 1=NE, 2=E, 3=SE, 4=S, 5=SW, 6=W, 7=NW
// Uses WORLD-SPACE angle (atan2(dy, dx) where +x=E, +y=S)
// Converts to 8 compass slices of 45° each
function angleToDir8(angle) {
    // Normalize to [0, 2π)
    let a = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    // 0=right(E), rotate so 0=N: subtract π/2, so N is at angle -π/2
    // Map: E=2, SE=3, S=4, SW=5, W=6, NW=7, N=0, NE=1
    // Offset by half-slice (π/8) for centering
    const slice = Math.PI / 4;
    const idx = Math.floor((a + slice / 2) / slice) % 8;
    // atan2 angles: 0=E, π/2=S, π=W, -π/2=N
    // Map: 0→E(2), 1→SE(3), 2→S(4), 3→SW(5), 4→W(6), 5→NW(7), 6→N(0), 7→NE(1)
    const map = [2, 3, 4, 5, 6, 7, 0, 1];
    return map[idx];
}

// Direction index to display angle (for slash arcs etc.)
// Returns the world-space angle this direction faces
const DIR8_ANGLES = [
    -Math.PI / 2,          // 0: N (up)
    -Math.PI / 4,          // 1: NE
    0,                     // 2: E (right)
    Math.PI / 4,           // 3: SE
    Math.PI / 2,           // 4: S (down)
    Math.PI * 3 / 4,       // 5: SW
    Math.PI,               // 6: W (left)
    -Math.PI * 3 / 4,      // 7: NW
];

// Direction names for debug
const DIR8_NAMES = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

// ============================================================
// CAMERA
// ============================================================
const CAMERA_ZOOM = 2.4; // Wider world view; actor sizes remain in canonical metres.
const PLAYER_HEIGHT_M = 1.72;
const VERTICAL_PX_PER_M = 8 * Math.sqrt(6);
const PLAYER_SPRITE_H = PLAYER_HEIGHT_M * VERTICAL_PX_PER_M;
const HOUSE_VARIANT_REVIEW = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('house-variant') === 'house.a.02';
let houseVariantMetadata = null;
const HOUSE_G1_8_TEST = HOUSE_VARIANT_REVIEW || typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('house-test') === '1';
// Global shake multiplier (can be tuned). Lower to reduce overall camera shake intensity.
const CAMERA_SHAKE_MULTIPLIER = 1.0;
const camera = {
    x: 0, y: 0,
    targetX: 0, targetY: 0,
    zoom: HOUSE_VARIANT_REVIEW ? 3.0 : CAMERA_ZOOM,
    shake: 0,
    shakeDecay: 0.92,
    update() {
        // Faster follow to reduce perceptible camera trailing
        const followLerp = 0.28;
        this.x += (this.targetX - this.x) * followLerp;
        this.y += (this.targetY - this.y) * followLerp;
        // Smoothly decay shake and compute deterministic shake offsets
        this.shake *= this.shakeDecay;
        this._shakePhase = (this._shakePhase || 0) + 0.12;
        this._shakeX = Math.sin(this._shakePhase) * this.shake * 0.6;
        this._shakeY = Math.cos(this._shakePhase * 1.3) * this.shake * 0.6;
    },
    getOffset() {
        // Use the precomputed, smoothed shake values (deterministic) instead of Math.random
        const shakeX = this._shakeX || 0;
        const shakeY = this._shakeY || 0;
        // Remove the small vertical bias so the player is visually centered vertically.
        return {
            x: canvas.width / 2 / this.zoom - this.x + shakeX,
            y: canvas.height / 2 / this.zoom - this.y + shakeY
        };
    },
    addShake(amount) {
        // Simple additive shake (restored to previous behavior).
        this.shake = Math.min(this.shake + amount * CAMERA_SHAKE_MULTIPLIER, 15);
    }
};

// ============================================================
// GREYLINE SYSTEM — The Heart of Everything
// Neither extreme is evil. Both are pathological when fixed.
// Health exists only in motion.
// ============================================================

// ============================================================
// GREYLINE SYSTEM — Unified control board (g ∈ [-1,+1])
// value (0..1) remains for legacy UI positioning.
// ============================================================
// Toggle to disable the internal exploratory oscillator (requested by user)
const GREYLINE_DISABLE_OSC = true;
const GREYLINE_DEFAULTS = {
    p: 2.0,
    tau: 0.25,
    q: 2.0,
    gDotMax: 1.5,
    N_vol: 120,          // ~2s @ 60fps
    eta: 0.25,
    kV0: 1.0,
    kT0: 1.0,
    samFill: 0.35,
    samDecay: 0.30,
    samT1: 0.25,
    samT2: 0.55,
    samT3: 0.80,
    // Samsarra triggers on extremity + persistence (symmetrical)
    samATheta: 0.70
};

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sgn = (x) => (x < 0 ? -1 : (x > 0 ? 1 : 0));

// Geometry helpers — used for LOS occlusion checks (simple, fast circle approximations)
function _segmentPointDistSq(x1, y1, x2, y2, px, py) {
    const vx = x2 - x1, vy = y2 - y1;
    const wx = px - x1, wy = py - y1;
    const denom = (vx*vx + vy*vy) || 1e-6;
    const t = Math.max(0, Math.min(1, (vx*wx + vy*wy) / denom));
    const cx = x1 + vx * t, cy = y1 + vy * t;
    const dx = px - cx, dy = py - cy;
    return dx*dx + dy*dy;
}

function isOccludedBetween(x1, y1, x2, y2) {
    // Check large props (configured list = "large props only")
    if (world && world.props) {
        for (const p of world.props) {
            if (!p) continue;
            // only treat large prop types as occluders by default
            if (!(p.type === 'deadTree1' || p.type === 'deadTree2' || p.type === 'oldWell' || p.type === 'woodenCart' || p.type === 'hayPile' || p.type === 'lanternPost')) continue;
            const pr = (p.scale || 1.0) * TILE_W * 0.30;
            const d2 = _segmentPointDistSq(x1, y1, x2, y2, p.x, p.y);
            if (d2 < pr*pr) return true;
        }
    }
    // Trees are large occluders (use height-based radius)
    if (world && world.trees) {
        for (const t of world.trees) {
            if (!t) continue;
            const tr = (t.height || 1.0) * TILE_W * 0.25;
            const d2 = _segmentPointDistSq(x1, y1, x2, y2, t.x, t.y);
            if (d2 < tr*tr) return true;
        }
    }
    return false;
}

// World collision test used for player movement blocking. Returns true when (wx,wy)
// intersects any outside asset that should be impassable (structures, props, trees, fences, wall segments).
function isBlockedAt(wx, wy) {
    // Structures (axis-aligned rectangles)
    if (world && world.structures) {
        for (const s of world.structures) {
            if (!s) continue;
            const b = structureBounds(s);
            if (wx > b.minX && wx < b.maxX && wy > b.minY && wy < b.maxY) return true;
        }
    }

    // Props (circular masks scaled by prop.scale)
    // NOTE: fog / haze are purely visual — skip any prop that is haze/fog or explicitly marked passable
    if (world && world.props) {
        for (const p of world.props) {
            if (!p) continue;
            // Visual-only haze/fog (sometimes present as props) must not block
            if (p.type === 'haze' || p.type === 'fog' || p.type === 'hazePatch' || p.type === 'fogPatch' || p.passable || p.visualOnly) continue;
            const r = p.collisionRadius ?? (0.6 * (p.scale || 1.0));
            const dx = wx - p.x;
            const dy = wy - p.y;
            if (dx*dx + dy*dy < r*r) return true;
        }
    }

    // Trees (circular masks derived from height)
    if (world && world.trees) {
        for (const t of world.trees) {
            if (!t) continue;
            const r = t.collisionRadius ?? (0.6 * (t.height || 1.0));
            const dx = wx - t.x;
            const dy = wy - t.y;
            if (dx*dx + dy*dy < r*r) return true;
        }
    }

    // Fence posts (small blockers)
    if (world && world.fencePosts) {
        for (const f of world.fencePosts) {
            if (!f) continue;
            const r = f.collisionRadius ?? 0.35;
            const dx = wx - f.x;
            const dy = wy - f.y;
            if (dx*dx + dy*dy < r*r) return true;
        }
    }

    // Wall segments / gate pillars (point-like blockers)
    if (world && world.wallSegments) {
        for (const w of world.wallSegments) {
            if (!w) continue;
            const dx = wx - w.x;
            const dy = wy - w.y;
            if (dx*dx + dy*dy < 0.6*0.6) return true;
        }
    }
    if (world && world.gatePos) {
        const g = world.gatePos;
        const lp = g.leftPillar, rp = g.rightPillar;
        if (lp) { const dx = wx - lp.x, dy = wy - lp.y; if (dx*dx + dy*dy < 0.8*0.8) return true; }
        if (rp) { const dx = wx - rp.x, dy = wy - rp.y; if (dx*dx + dy*dy < 0.8*0.8) return true; }
    }

    return false;
}

const greyline = {
    // Legacy [0..1] for UI; internal master axis is g ∈ [-1,+1]
    value: 0.5,       // 0 = full restraint, 1 = full compulsion
    momentum: 0,
    drift: 0,
    lastValue: 0.5,
    movementRate: 0,
    stagnationTimer: 0,
    visibleTimer: 0,

    // Unified board state (authoritative read-only signals)
    g: 0.0,           // [-1,+1]
    a: 0.0,           // |g| in [0,1]
    s: 0,             // sign(g)
    gDot: 0.0,
    tMag: 0.0,
    v: 0.0,
    persist: 0.0,
    sam: 0.0,
    samTier: 0,

    // Complexity gains
    kL: 1.0,
    kV: 1.0,
    kT: 1.0,

    // Output knobs for subsystems
    knobs: {
        timeScale: 1.0,
        ui: { clarity: 1.0, jitter: 0.0, warn: 0.0, greylineAlpha: 1.0, showLabels: false, cooldownWarp: 0.0 },
        // raised defaults so haze/grain/scanline VFX are perceptible without extreme greyline
        vfx: { vignette: 0.35, grain: 0.08, flicker: 0.06, ghost: 0.04, hazeEdge: 0.20 },
        aud: { density: 0.2, lf: 0.0, dis: 0.0, spikes: 0.0, legibility: 1.0, mute: 0.0 },
        ctl: { damping: 0.15, jitter: 0.0, cancelRel: 1.0, commitBias: 0.0 },
        skl: { size: 1.0, dur: 1.0, noise: 0.0, cdEff: 1.0, selfCost: 1.0, soundHarsh: 0.0 },
        ai:  { aggro: 1.0, feint: 0.0, swarm: 0.0, punishOver: 0.0, punishStatic: 0.0, delay: 0.0, readable: 1.0 },
        env: { hazDensity: 1.0, ambiguity: 0.0, safeWidth: 1.0, pacing: 1.0, hazeShadowAlign: 0.65 },
        eco: { stamRegen: 1.0, stamDrain: 1.0 }
    },

    // Internals for volatility & persistence
    _cfg: { ...GREYLINE_DEFAULTS },
    _gHist: new Array(GREYLINE_DEFAULTS.N_vol).fill(0),
    _gHistI: 0,
    _gHistFilled: 0,
    _lastG: 0,
    _lastActionCount: 0,
    _actionRateEMA: 0,
    _spamEMA: 0,
    _damageTradeEMA: 0,
    _combatHold: 0,
    _idleThreatEMA: 0,
    _menuFixEMA: 0,
    _lastHealth: null,

    // External impulses (keeps existing callsites intact)
    push(direction, amount) {
        // direction: -1 restraint, +1 compulsion
        // Asymmetry: compulsion should be easier to slip into than to *max*, while restraint must be reachable.
        // Also: diminishing returns near edges prevents "slam to max" from a single habit loop.
        const g = this.g ?? (this.value - 0.5) * 2.0;
        const a = Math.abs(g);
        // Allow stronger pushes near extremes (reduce damping so extremes hold more)
        const edgeDamp = 1.0 - a * 0.40; // near extremes, impulses soften (reduced from 0.55)
        // Symmetric exponential gain: per-impulse scaling is equal for both sides
        // Increase compulsion-side gain so compulsion pushes are stronger (user requested +5x)
        const asym = 5.0; // symmetric: both compulsion and restraint scaled ×5
        const scaled = amount * edgeDamp * asym;

        // telemetry: remember last push and optionally log (toggle with F3)
        this._lastPush = { dir: direction > 0 ? 'compulsion' : 'restraint', amount: amount, scaled: scaled, t: (performance&&performance.now)?performance.now():Date.now() };
        if (typeof DEV_GREY_DEBUG !== 'undefined' && DEV_GREY_DEBUG) {
            const caller = (new Error()).stack.split('\n')[2] || '';
            console.info(`[GREY PUSH] ${this._lastPush.dir} amount=${amount.toFixed(5)} scaled=${scaled.toFixed(5)} caller=${caller.trim()}`);
        }

        this.momentum += direction * scaled;

        // UI visibility is interpretive; show briefly when the state is being *moved*
        this.visibleTimer = Math.min(2.0, this.visibleTimer + 0.12 + Math.min(0.18, Math.abs(scaled) * 4));
    },

    // Core feature vector Φ update + knobs
    update(dt, ctx = {}) {
        const cfg = this._cfg;

        // --- Legacy movement integration (kept) ---
        this.lastValue = this.value;
        this.value += this.momentum * dt;
        this.momentum *= 0.94;

        // Gentle return-to-center: the world does not let you *stay* at an edge forever.
        // Stronger when you are far from center; softer in the flux band.
        const g0 = (this.value - 0.5) * 2.0;
        const a0 = Math.abs(g0);
        // Reduced baseline centering so extremes hold longer
        const centerPull = (0.012 + a0 * 0.040) * (1.0 - (a0 < cfg.tau ? 0.35 : 0.0));
        // Stronger centering while inside the Holdfast (smooth, non-snapping)
        const hubMultiplier = (ctx && ctx.inHub) ? 2.0 : 1.0;
        // Stamina-linked centering: players with high stamina resist auto-centering;
        // when stamina is low, centering is stronger (so it's slower, stamina-contestable decay).
        let centeringMultiplier = 1.0;
        try {
            if (typeof player !== 'undefined' && player && player.maxStamina) {
                const stamNorm = clamp01(player.stamina / Math.max(1, player.maxStamina));
                // high stamina -> small multiplier (resist centering); low stamina -> full centering
                centeringMultiplier = 0.25 + (1.0 - stamNorm) * 0.75; // range [0.25, 1.0]
            }
        } catch (e) { centeringMultiplier = 1.0; }
        this.value += (0.5 - this.value) * centerPull * dt * hubMultiplier * centeringMultiplier;

        // Gentle drift (world pressure), but damped near center
        const centerDamp = 1.0 - Math.pow(1.0 - (1.0 - Math.abs(this.value - 0.5) * 2), 2);
        this.drift += (Math.random() - 0.5) * 0.001 * (0.6 + centerDamp * 0.4);
        this.drift *= 0.99;
        this.value += this.drift * dt;

        // Oscillator: gentle alternating nudge to encourage breaking repetitive habits.
        // Amplitude scales with behavioural stickiness (persist / stagnation) —
        // but *do not* amplify oscillator while the player is actively spamming actions.
        this._oscPhase = (this._oscPhase || 0) + dt * (0.06 + this.persist * 0.18);
        // Reduce oscillator influence when recent spam is high so player-driven pushes dominate
        const spamFactor = clamp01(1 - (this._spamEMA || 0)); // 1 => not spamming, 0 => heavy spam
        const stickiness = clamp01(this.persist + spamFactor * 0.5 + Math.min(1, this.stagnationTimer / 6.0));
        let oscAmp = 0.05 * stickiness; // max ~0.05 (now reduced while spamming)
        if (GREYLINE_DISABLE_OSC) oscAmp = 0.0;
        // Bias the oscillator *away* from the currently dominant side so it encourages switching
        const oscSign = (this.g >= 0) ? -1 : 1;
        const oscBias = Math.sin(this._oscPhase) * oscAmp * oscSign;
        // Apply softly via momentum; scale by spamFactor so active play drowns out the oscillator
        this.momentum += oscBias * 0.35 * spamFactor; // smaller contribution when spamming

        // Note: samsarra thresholds/config remain unchanged.

        // Clamp away from hard edges (prevents stuck-at-1). Widened limits so extremes can be held more.
        this.value = Math.max(0.005, Math.min(0.995, this.value));

        // Track movement rate (legacy)
        const delta = Math.abs(this.value - this.lastValue);
        this.movementRate = this.movementRate * 0.95 + delta * 0.05;

        if (this.movementRate < 0.0005) this.stagnationTimer += dt;
        else this.stagnationTimer = Math.max(0, this.stagnationTimer - dt * 2);

        // UI visibility
        if (this.visibleTimer > 0) this.visibleTimer = Math.max(0, this.visibleTimer - dt * 0.3);

        // --- Unified axis ---
        this.g = (this.value - 0.5) * 2.0;             // [-1,+1]
        this.a = Math.abs(this.g);                      // [0,1]
        this.s = sgn(this.g);

        // Trend (gDot) and magnitude (tMag)
        const gNow = this.g;
        const gPrev = this._lastG;
        this.gDot = (gNow - gPrev) / Math.max(0.000001, dt);
        const tNorm = clamp01(Math.abs(this.gDot) / cfg.gDotMax);
        this.tMag = this.tMag * 0.92 + tNorm * 0.08;

        // Volatility v: rolling stddev of g
        this._gHist[this._gHistI] = gNow;
        this._gHistI = (this._gHistI + 1) % cfg.N_vol;
        this._gHistFilled = Math.min(cfg.N_vol, this._gHistFilled + 1);
        if (this._gHistFilled >= 8) {
            const arr = this._gHist;
            const n = this._gHistFilled;
            let mean = 0;
            for (let i = 0; i < n; i++) mean += arr[i];
            mean /= n;
            let varSum = 0;
            for (let i = 0; i < n; i++) { const d = arr[i] - mean; varSum += d * d; }
            const stdev = Math.sqrt(varSum / n);
            this.v = clamp01(stdev / 0.35); // 0.35 ≈ "very unstable"
        } else {
            this.v = 0;
        }
        this._lastG = gNow;

        // Complexity factor (levels amplify sensitivity)
        const level = (ctx.xp && ctx.xp.level) ? ctx.xp.level : (xpSystem ? xpSystem.level : 1);
        this.kL = 1 + cfg.eta * Math.log(1 + Math.max(0, level));
        this.kV = cfg.kV0 * this.kL;
        this.kT = cfg.kT0 * this.kL;

        // Persistence (fixation) from behaviour proxies
        const playerRef = ctx.player || (typeof player !== 'undefined' ? player : null);
        const enemiesRef = ctx.enemies || (typeof enemies !== 'undefined' ? enemies : []);
        const inventoryOpenRef = (ctx.inventoryOpen !== undefined) ? ctx.inventoryOpen : (typeof inventoryOpen !== 'undefined' ? inventoryOpen : false);
        const upgradeOpenRef = (ctx.upgradeOpen !== undefined) ? ctx.upgradeOpen : (typeof upgradeOpen !== 'undefined' ? upgradeOpen : false);
        const shopOpenRef = (ctx.shopOpen !== undefined) ? ctx.shopOpen : (typeof shopOpen !== 'undefined' ? shopOpen : false);

        // Menu fixation (time spent in menus)
        const menuOpen = inventoryOpenRef || upgradeOpenRef || shopOpenRef;
        this._menuFixEMA = this._menuFixEMA * 0.98 + (menuOpen ? 0.02 : 0);

        if (playerRef) {
            // Action rate & spam: actions per second above a soft baseline
            const ac = playerRef.actionCount || 0;
            const dA = Math.max(0, ac - this._lastActionCount);
            this._lastActionCount = ac;
            const aps = dA / Math.max(dt, 0.000001);
            this._actionRateEMA = this._actionRateEMA * 0.90 + aps * 0.10;
            const spam = clamp01((this._actionRateEMA - 1.5) / 6.0); // > ~1.5 aps starts counting
            this._spamEMA = this._spamEMA * 0.92 + spam * 0.08;

            // "In combat" proxy: enemy within range
            let inCombat = false;
            if (enemiesRef && enemiesRef.length) {
                let enemiesToCheck = enemiesRef;
                if (typeof frameLag !== 'undefined' && frameLag > 24 && enemiesRef.length > 30) {
                    enemiesToCheck = enemiesRef.slice(0, Math.max(1, Math.ceil(enemiesRef.length * perfQuality)));
                }
                for (let i = 0; i < enemiesToCheck.length; i++) {
                    const e = enemiesToCheck[i];
                    if (!e || e.health <= 0) continue;
                    const dx = e.x - playerRef.x;
                    const dy = e.y - playerRef.y;
                    if (dx*dx + dy*dy < 12*12) { inCombat = true; break; }
                }
            }

            // Combat hold = refusal to disengage (not moral; just a pressure proxy)
            this._combatHold = clamp01(this._combatHold + (inCombat ? dt * 0.20 : -dt * 0.35));

            // Idle under threat = "ruminating" while danger present
            const speed = Math.sqrt((playerRef.vx||0)**2 + (playerRef.vy||0)**2);
            const recentAction = (performance.now() - (playerRef.lastActionTime||0)) < 700;
            const idleThreat = (inCombat && speed < 0.08 && !recentAction) ? 1 : 0;
            this._idleThreatEMA = this._idleThreatEMA * 0.92 + idleThreat * 0.08;

            // Damage trade: taking damage shortly after acting
            if (this._lastHealth === null) this._lastHealth = playerRef.health;
            const tookDamage = playerRef.health < this._lastHealth - 0.01;
            const traded = tookDamage && ((performance.now() - (playerRef.lastActionTime||0)) < 450);
            this._damageTradeEMA = this._damageTradeEMA * 0.90 + (traded ? 0.10 : -0.05);
            this._damageTradeEMA = clamp01(this._damageTradeEMA);
            this._lastHealth = playerRef.health;
        }

        // Behavioural persistence in [0,1] (measurable, not moral)
        this.persist = clamp01(
            0.25 * this._spamEMA +
            0.20 * this._damageTradeEMA +
            0.20 * this._combatHold +
            0.15 * this._idleThreatEMA +
            0.10 * this._menuFixEMA +
            0.10 * clamp01(this.stagnationTimer / 6.0) // standing still too long becomes fixation
        );

        // Samsarra: entrenchment when extremity is sustained + persisted
        const fill = cfg.samFill * Math.max(0, this.a - cfg.samATheta) * this.persist;
        const decay = cfg.samDecay * (1.0 - this.a); // centre helps empty it
        this.sam = clamp01(this.sam + dt * (fill - decay));

        // Tiering
        this.samTier = (this.sam < cfg.samT1) ? 0 :
                       (this.sam < cfg.samT2) ? 1 :
                       (this.sam < cfg.samT3) ? 2 : 3;

        // Weights
        const wL = Math.pow(Math.max(0, -this.g), cfg.p);
        const wR = Math.pow(Math.max(0,  this.g), cfg.p);
        const wB = 1.0 - this.a;
        const wE = 1.0 - wB;
        const wF = clamp01(1.0 - Math.pow(this.a / cfg.tau, cfg.q));

        // --- Knobs (small, experiential—not "buffs") ---
        // Time perception: compulsion speeds, restraint slows
        // Increased upper cap so compulsion gives a noticeably faster feel (music + motion)
        // timeScale now allows slower perception under restraint (down to 0.6)
        this.knobs.timeScale = clamp(1.0 - wL*0.20 + wR*0.18 + this.samTier*0.05, 0.60, 1.45);

        // UI interpretive layer (legibility in flux, distortion at extremes)
        this.knobs.ui.clarity = clamp(0.85 + wB*0.25 - wE*0.35 - this.kV*this.v*0.10 - this.samTier*0.08, 0.35, 1.0);
        this.knobs.ui.jitter  = clamp01(wR*0.25 + this.kV*this.v*0.15 + this.samTier*0.10);
        this.knobs.ui.warn    = clamp01(wE*0.70 + this.kV*this.v*0.35 + this.samTier*0.15);
        // Greyline should not become a permanent HUD obsession. It appears when you're *moving it*,
        // when samsarra is active, or during explicit attunement.
        const inAttune = (typeof player !== 'undefined' && player && player.isAttuning);
        const shouldShowBar = (this.samTier > 0) || inAttune || ((this.visibleTimer > 0.10) && (this.a > cfg.tau * 0.75));
        this.knobs.ui.greylineAlpha = shouldShowBar ? (clamp01(this.visibleTimer / 1.2) * this.knobs.ui.clarity) : 0.0;
        this.knobs.ui.showLabels = (this.knobs.ui.greylineAlpha > 0.68 && this.a > 0.35) || (this.samTier >= 2);


        // Cooldown legibility warp (interpretive UI only; does not change actual cooldowns)
        this.knobs.ui.cooldownWarp = clamp(-wL*0.10 + wR*0.14 + this.kV*this.v*0.08 + this.samTier*0.04, -0.25, 0.25);

        // Input / control feel (subtle: "I swear I timed it right…")
        // Lower the max damping so players don't become unresponsive at high restraint
        this.knobs.ctl.damping   = clamp(0.15 + wL*0.35 - wR*0.10, 0.10, 0.45);
        this.knobs.ctl.jitter    = clamp01(wR*0.20 + this.kV*this.v*0.10 + this.samTier*0.05);
        this.knobs.ctl.cancelRel = clamp(1.0 - wR*0.35 - this.kV*this.v*0.10 - this.samTier*0.08, 0.25, 1.0);
        this.knobs.ctl.commitBias= clamp(wR*0.35 - wL*0.20 + this.samTier*0.05, -0.40, 0.60);

        // Skill modulation (modulators only — each skill still owns its "meaning")
        this.knobs.skl.size      = clamp(1.0 - wL*0.18 + wR*0.28, 0.75, 1.35);
        this.knobs.skl.dur       = clamp(1.0 + wL*0.22 - wR*0.22, 0.75, 1.40);
        this.knobs.skl.noise     = clamp01(wR*0.35 + this.kV*this.v*0.20 + this.samTier*0.12 + this.tMag*0.10);
        this.knobs.skl.cdEff     = clamp(1.0 + wB*0.15 - wR*0.10, 0.85, 1.20);
        this.knobs.skl.selfCost  = clamp(1.0 + wR*0.40 + this.samTier*0.15, 0.90, 1.75);
        this.knobs.skl.soundHarsh= clamp01(wR*0.40 + this.samTier*0.20 + this.kV*this.v*0.10);


        // Eco
        this.knobs.eco.stamRegen = 1.0 + wL*0.20 + wB*0.10 - wR*0.30 - this.samTier*0.10;
        this.knobs.eco.stamDrain = 1.0 + wR*0.35 + this.samTier*0.10;

        // VFX
        // Vignette – only restraint drives a gentle tunnel effect now
        // (compulsion/grain etc are left unchanged, but the base
        // vignette value no longer darkens with compulsion/edge weights)
        // keep overall strength low but allow a clear border at extremes
        // vignette increases nonlinearly and also reacts to desaturation
        let vig = 0.15 + wL * 0.45 + Math.pow(wL,3) * 0.25;
        // add a saturation control for the 'bleak' colour effect
        const sat = clamp(1.0 - Math.pow(wL,3) * 0.7, 0.1, 1.0);
        this.knobs.vfx.saturation = sat;
        // compulsion-driven overdrive/contrast for overstimulation (gradual)
        this.knobs.vfx.overdrive = 1 + wR * 0.4 + Math.pow(wR,2) * 0.2;
        this.knobs.vfx.contrast = 1 + wR * 0.3;
        // when saturation is low, strengthen the border so it remains visible
        vig = Math.min(1.0, vig + (1 - sat) * 0.3);
        this.knobs.vfx.vignette = vig;
        // Non-linear compulsion intensity so visual noise ramps hard near extremes
        const compIntensity = Math.pow(Math.max(0, wR), 1.6);
        this.knobs.vfx.grain    = 0.05 + wR*0.75 + compIntensity * 0.40 + this.kV*this.v*0.20 + this.samTier*0.20;
        this.knobs.vfx.flicker  = 0.00 + wR*0.55 + compIntensity * 0.30 + this.tMag*0.35 + this.samTier*0.18;
        this.knobs.vfx.ghost    = 0.00 + wR*0.55 + compIntensity * 0.28 + this.tMag*0.25 + this.samTier*0.25;
        // peripheral haze removed – keep edges clean
        this.knobs.vfx.hazeEdge = 0.00; // previously 0.10 + wE*0.35 + samTier*0.20

        // Audio
        this.knobs.aud.mute       = 0.00 + wL*0.45;
        this.knobs.aud.density    = 0.20 + wR*0.55 + this.samTier*0.15;
        this.knobs.aud.lf         = 0.00 + wR*0.50 + this.samTier*0.20;
        this.knobs.aud.dis        = 0.00 + wR*0.35 + this.kV*this.v*0.20 + this.samTier*0.20;
        this.knobs.aud.spikes     = 0.00 + wR*0.25 + this.persist*0.30;
        this.knobs.aud.legibility = clamp(1.0 + wB*0.20 - wE*0.25 - this.samTier*0.08, 0.25, 1.0);

        // AI pushback (world mirrors fixation)
        this.knobs.ai.aggro        = 1.0 + wR*0.35 - wL*0.03 + this.samTier*0.12; // slightly more aggressive under compulsion
        this.knobs.ai.delay        = 0.0 + wL*0.50;
        this.knobs.ai.punishStatic = 0.0 + wL*0.60;
        this.knobs.ai.feint        = 0.0 + wR*0.55 + this.samTier*0.10;
        // Stronger swarm scaling for compulsion (keeps value sane via clamp01)
        this.knobs.ai.swarm        = clamp01(Math.min(1.0, wR * 0.95 + this.samTier * 0.25 + Math.pow(wR,2) * 0.25));
        this.knobs.ai.punishOver   = 0.0 + wR*0.65 + this.persist*0.20;
        this.knobs.ai.readable     = clamp(0.60 + wB*0.35 - wE*0.30 - this.samTier*0.10, 0.10, 1.0);

        // Env haze pushback
        this.knobs.env.hazDensity  = 1.0 + wR*0.25 + this.samTier*0.25;
        this.knobs.env.ambiguity   = wE*0.35 + this.kV*this.v*0.20;
        this.knobs.env.safeWidth   = clamp(1.0 - wL*0.30 - wR*0.20, 0.4, 1.0);
        this.knobs.env.pacing      = 1.0 - wL*0.10 + wR*0.20 + this.samTier*0.10;

        // Keep a little UI breathing whenever things are non-neutral
        if (wE > 0.05 || this.persist > 0.15 || this.samTier > 0) {
            this.visibleTimer = Math.min(2.0, this.visibleTimer + dt * 0.20);
        }

        // Expose weights for other systems (optional)
        this._wL = wL; this._wR = wR; this._wB = wB; this._wE = wE; this._wF = wF;
    },

    // --- Legacy helpers (kept) ---
    getDistance() {
        return Math.abs(this.value - 0.5) * 2;
    },
    getSide() {
        if (this.value < 0.42) return 'restraint';
        if (this.value > 0.58) return 'compulsion';
        return 'greyline';
    },
    isBalanced() { return this.getSide() === 'greyline'; },
    getExtremity() {
        const d = this.getDistance();
        return Math.max(0, (d - 0.2) / 0.8);
    }
};

// ============================================================
// PSYCHOLOGICAL STATS — 6 Total
// These are not numbers you min-max. They breathe.
// Stats shift dynamically based on Greyline tension.
// ============================================================
const psychStats = {
    agency:       { value: 0.75, target: 0.75, label: 'AGENCY' },
    awareness:    { value: 0.75, target: 0.75, label: 'AWARENESS' },
    precision:    { value: 0.70, target: 0.70, label: 'PRECISION' },
    adaptability: { value: 0.50, target: 0.50, label: 'ADAPTABILITY' },
    integrity:    { value: 0.80, target: 0.80, label: 'INTEGRITY' },
    burden:       { value: 0.30, target: 0.30, label: 'BURDEN' },
    
    // Track what the player does for behavioral stat shifts
    _behaviorCounters: {
        lastSkillUsed: null,
        skillRepeatCount: 0,
        attacksInWindow: 0,
        attackWindowTimer: 0,
        dodgesInWindow: 0,
        stealthTimer: 0,      // Time spent avoiding combat
        movementVariety: 0,   // How much direction changes
        lastMoveAngle: 0,
    },
    
    update(dt) {
        const dist = greyline.getDistance();
        const side = greyline.getSide();
        const extremity = greyline.getExtremity();
        const bc = this._behaviorCounters;
        
        // Decay attack window
        bc.attackWindowTimer = Math.max(0, bc.attackWindowTimer - dt);
        if (bc.attackWindowTimer <= 0) {
            bc.attacksInWindow = Math.max(0, bc.attacksInWindow - 1);
        }
        
        // ── AGENCY: Your ability to act deliberately ──
        // Degrades at both extremes, but differently
        if (side === 'restraint') {
            // Too much restraint → Agency stagnates (inputs feel heavy)
            this.agency.target = 0.75 - extremity * 0.45;
        } else if (side === 'compulsion') {
            // Too much compulsion → Agency fragments (unstable, over-trigger)
            this.agency.target = 0.75 - extremity * 0.35;
        } else {
            this.agency.target = 0.75 + this.adaptability.value * 0.1;
        }
        
        // ── AWARENESS: Sensitivity to environment & enemies ──
        if (side === 'restraint') {
            // Tunnel vision — see less, focus too narrow
            this.awareness.target = 0.75 - extremity * 0.5;
        } else if (side === 'compulsion') {
            // Sensory overload — sees too much, nothing is clear
            this.awareness.target = Math.min(1.0, 0.85 + extremity * 0.15);
            // But at extreme compulsion, awareness becomes noise
            if (extremity > 0.6) this.awareness.target = 0.9 - (extremity - 0.6) * 0.5;
        } else {
            this.awareness.target = 0.75;
        }
        
        // ── PRECISION: Effectiveness of deliberate actions ──
        if (side === 'restraint') {
            // Overcautious — precision goes up but becomes brittle
            this.precision.target = Math.min(0.9, 0.7 + extremity * 0.25);
            // Brittle: if restraint extreme, precision is high but shatters on action
        } else if (side === 'compulsion') {
            // Reckless — crits unreliable, sloppy execution
            this.precision.target = 0.7 - extremity * 0.4;
        } else {
            this.precision.target = 0.7;
        }
        
        // ── ADAPTABILITY: Speed at which systems respond to change ──
        // Grows with movement variety, shrinks with repetition
        if (side === 'restraint') {
            // Rigid patterns — locked into one behavior
            this.adaptability.target = Math.max(0.15, this.adaptability.value - extremity * 0.3 * dt);
        } else if (side === 'compulsion') {
            // Chaotic mutations — adaptability spikes but unreliably
            this.adaptability.target = this.adaptability.value + (Math.random() - 0.5) * extremity * 0.1 * dt;
        }
        // Stagnation kills adaptability regardless
        if (greyline.stagnationTimer > 5) {
            this.adaptability.target -= 0.01 * dt;
        }
        
        // ── INTEGRITY: Resistance to corruption & world pushback ──
        if (side === 'restraint') {
            // Brittle integrity — seems high, shatters suddenly
            this.integrity.target = 0.8 - extremity * 0.15;
            // The shattering happens in takeDamage, not here
        } else if (side === 'compulsion') {
            // Erosion over time — gradual, constant degradation
            this.integrity.target = 0.8 - extremity * 0.5;
        } else {
            this.integrity.target = 0.8;
        }
        
        // ── BURDEN: How much consequence you can carry ──
        // This stat INCREASES with hardship — it's not a resource to preserve
        // High burden = you can wield powerful effects safely
        // Low burden = backlash, exhaustion
        // It naturally rises during combat and falls during safety
        if (bc.attacksInWindow > 0) {
            this.burden.target = Math.min(1.0, this.burden.value + 0.01 * dt);
        } else {
            this.burden.target = Math.max(0.1, this.burden.value - 0.005 * dt);
        }
        // Extremes warp it
        if (side === 'restraint') {
            // Underutilised capacity — burden doesn't build
            this.burden.target -= extremity * 0.02 * dt;
        } else if (side === 'compulsion') {
            // Overload risk — burden builds too fast, collapses
            this.burden.target += extremity * 0.03 * dt;
            if (this.burden.value > 0.9) this.burden.target = 0.3; // collapse
        }
        
        // ── SMOOTHLY LERP toward targets ──
        const lerpRate = 0.015;
        for (const key of ['agency', 'awareness', 'precision', 'adaptability', 'integrity', 'burden']) {
            const stat = this[key];
            stat.value += (stat.target - stat.value) * lerpRate;
            stat.value = Math.max(0.05, Math.min(1.0, stat.value));
        }
        
        // ── BEHAVIORAL PUNISHMENT: "The game stops cooperating" ──
        // Spamming best skill → Precision decay
        if (bc.skillRepeatCount > 4) {
            this.precision.value -= 0.005 * dt * (bc.skillRepeatCount - 4);
        }
        // Over-stealthing (avoiding combat too long) → Awareness collapse
        bc.stealthTimer += dt;
        if (bc.stealthTimer > 8) {
            this.awareness.value -= 0.008 * dt;
        }
        // Tank-and-spank (just attacking, no skill use) → Burden overload handled elsewhere
    },
    
    // Record when a skill is used for repetition tracking
    recordSkillUse(skillKey) {
        const bc = this._behaviorCounters;
        if (bc.lastSkillUsed === skillKey) {
            bc.skillRepeatCount++;
        } else {
            bc.skillRepeatCount = Math.max(0, bc.skillRepeatCount - 2);
            bc.lastSkillUsed = skillKey;
        }
        bc.stealthTimer = 0; // using skills = engaging
    },
    
    recordAttack() {
        const bc = this._behaviorCounters;
        bc.attacksInWindow++;
        bc.attackWindowTimer = 3;
        bc.stealthTimer = 0;
    },
    
    recordDodge() {
        const bc = this._behaviorCounters;
        bc.dodgesInWindow++;
        // Dodging builds adaptability
        this.adaptability.value = Math.min(1.0, this.adaptability.value + 0.015);
    },
    
    recordMovementDirection(angle) {
        const bc = this._behaviorCounters;
        const diff = Math.abs(angle - bc.lastMoveAngle);
        if (diff > 0.3) {
            bc.movementVariety = Math.min(1, bc.movementVariety + 0.05);
            // Varied movement builds adaptability
            this.adaptability.value = Math.min(1.0, this.adaptability.value + 0.002);
        }
        bc.lastMoveAngle = angle;
        bc.movementVariety *= 0.998;
    },
    
    getStatus(key) {
        const v = this[key].value;
        if (v > 0.65) return 'stable';
        if (v > 0.35) return 'strained';
        return 'degraded';
    }
};

// ============================================================
// INPUT
// ============================================================
function installHouseTestMobileControls() {
    if (!HOUSE_G1_8_TEST || typeof document === 'undefined') return;
    if (document.getElementById('house-test-mobile-controls')) return;

    const wrap = document.createElement('div');
    wrap.id = 'house-test-mobile-controls';
    wrap.style.position = 'fixed';
    wrap.style.left = '18px';
    wrap.style.bottom = '18px';
    wrap.style.zIndex = '5000';
    wrap.style.display = 'grid';
    wrap.style.gridTemplateColumns = '56px 56px 56px';
    wrap.style.gridTemplateRows = '56px 56px 56px';
    wrap.style.gap = '6px';
    wrap.style.touchAction = 'none';
    wrap.style.userSelect = 'none';
    wrap.style.webkitUserSelect = 'none';

    const makeButton = (label, key, col, row) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.dataset.key = key;
        b.style.gridColumn = String(col);
        b.style.gridRow = String(row);
        b.style.border = '1px solid rgba(230,210,170,0.55)';
        b.style.borderRadius = '12px';
        b.style.background = 'rgba(8,8,8,0.72)';
        b.style.color = 'rgba(245,230,200,0.95)';
        b.style.font = '700 20px monospace';
        b.style.touchAction = 'none';

        const down = (e) => {
            e.preventDefault();
            input.keys[key] = true;
            try { b.setPointerCapture?.(e.pointerId); } catch (_) {}
        };
        const up = (e) => {
            e.preventDefault();
            input.keys[key] = false;
        };

        b.addEventListener('pointerdown', down);
        b.addEventListener('pointerup', up);
        b.addEventListener('pointercancel', up);
        b.addEventListener('lostpointercapture', up);
        b.addEventListener('touchstart', down, { passive: false });
        b.addEventListener('touchend', up, { passive: false });
        b.addEventListener('touchcancel', up, { passive: false });

        wrap.appendChild(b);
    };

    makeButton('▲', 'w', 2, 1);
    makeButton('◀', 'a', 1, 2);
    makeButton('▶', 'd', 3, 2);
    makeButton('▼', 's', 2, 3);

    const tag = document.createElement('div');
    tag.textContent = 'HOUSE TEST';
    tag.style.gridColumn = '1 / span 3';
    tag.style.gridRow = '3';
    tag.style.alignSelf = 'end';
    tag.style.justifySelf = 'center';
    tag.style.transform = 'translateY(22px)';
    tag.style.font = '10px monospace';
    tag.style.letterSpacing = '1px';
    tag.style.color = 'rgba(230,210,170,0.75)';
    tag.style.pointerEvents = 'none';
    wrap.appendChild(tag);

    document.body.appendChild(wrap);
}

const input = {
    keys: {},
    mouse: { x: 0, y: 0, down: false, clicked: false, rightDown: false, rightClicked: false },
    
    init() {
        // keyboard
        window.addEventListener('keydown', e => {
            this.keys[e.key.toLowerCase()] = true;
            if (e.key === ' ') e.preventDefault();
        });
        window.addEventListener('keyup', e => this.keys[e.key.toLowerCase()] = false);

        // ensure the canvas handles pointer/touch events and doesn't trigger gestures
        canvas.style.touchAction = 'none';

        const mapPointer = (px, py) => {
            const rect = canvas.getBoundingClientRect();
            const cx = (px - rect.left);
            const cy = (py - rect.top);
            const sx = rect.width > 0 ? (cx * (canvas.width / rect.width)) : 0;
            const sy = rect.height > 0 ? (cy * (canvas.height / rect.height)) : 0;
            this.mouse.x = sx;
            this.mouse.y = sy;
        };

        const handleMove = e => {
            if (e.touches && e.touches.length) {
                mapPointer(e.touches[0].clientX, e.touches[0].clientY);
            } else {
                mapPointer(e.clientX, e.clientY);
            }
        };

        canvas.addEventListener('mousemove', handleMove);
        canvas.addEventListener('pointermove', handleMove);
        canvas.addEventListener('touchmove', e => { e.preventDefault(); handleMove(e); }, { passive: false });
        
        // also listen globally in capture phase so clicks pass through light DOM overlays
        const globalDown = e => {
            const rect = canvas.getBoundingClientRect();
            const px = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX);
            const py = e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY);
            if (px == null || py == null) return;
            if (px >= rect.left && px <= rect.right && py >= rect.top && py <= rect.bottom) {
                // update mouse coordinates too so attacks aim correctly
                mapPointer(px, py);
                handleDown(e);
            }
        };
        const globalUp = e => {
            const rect = canvas.getBoundingClientRect();
            const px = e.clientX || (e.changedTouches && e.changedTouches[0] && e.changedTouches[0].clientX);
            const py = e.clientY || (e.changedTouches && e.changedTouches[0] && e.changedTouches[0].clientY);
            if (px == null || py == null) return;
            if (px >= rect.left && px <= rect.right && py >= rect.top && py <= rect.bottom) {
                handleUp(e);
            }
        };
        window.addEventListener('pointerdown', globalDown, true);
        window.addEventListener('pointerup', globalUp, true);
        window.addEventListener('touchstart', globalDown, { passive: false, capture: true });
        window.addEventListener('touchend', globalUp, { passive: false, capture: true });

        const handleDown = e => {
            // suppress browser context menu when interacting with the canvas
            if (e.button === 2) e.preventDefault();
            if (e.pointerType === 'touch' || e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; }
            if (e.button === 2) { this.mouse.rightDown = true; this.mouse.rightClicked = true; }
        };
        const handleUp = e => {
            if (e.pointerType === 'touch' || e.button === 0) this.mouse.down = false;
            if (e.button === 2) this.mouse.rightDown = false;
        };
        canvas.addEventListener('mousedown', handleDown);
        canvas.addEventListener('pointerdown', handleDown);
        canvas.addEventListener('touchstart', handleDown, { passive: false });
        canvas.addEventListener('mouseup', handleUp);
        canvas.addEventListener('pointerup', handleUp);
        canvas.addEventListener('touchend', handleUp);

        // suppress all native context menus while game is active so right-click can be used for shooting
        canvas.addEventListener('contextmenu', e => e.preventDefault());
        window.addEventListener('contextmenu', e => {
            if (gameState !== GameState.TITLE) {
                e.preventDefault();
            }
        });
        // the old document guard was too narrow and missed cases where another element
        // covered the canvas; the window handler above is more reliable.
        // document.addEventListener('contextmenu', e => {
        //     if (gameState !== GameState.TITLE && e.target === canvas) {
        //         e.preventDefault();
        //     }
        // });
    },
    
    clearFrame() {
        this.mouse.clicked = false;
        this.mouse.rightClicked = false;
    }
};

// ============================================================
// WORLD GENERATION — THE VERGE
// ============================================================
const WORLD_SIZE = 100;
const world = {
    tiles: [],
    structures: [],
    fencePosts: [],
    hazePools: [],
    trees: [],
    wallSegments: [],   // Hub perimeter wall
    npcs: [],           // Holdfast NPCs
    gatePos: null,      // Gate exit location
    props: [],          // Environmental sprites (dead trees, rocks, ruins, fences, barns)
    fogParticles: [],   // Persistent atmospheric fog patches
    ambientLeaves: [],  // Drifting dead leaves
    ambientDust: [],    // Floating dust motes
    
    generate() {
        const hubX = WORLD_SIZE / 2;
        const hubY = WORLD_SIZE / 2;
        
        // Terrain tiles — richer, more varied, no black gaps
        for (let x = 0; x < WORLD_SIZE; x++) {
            this.tiles[x] = [];
            for (let y = 0; y < WORLD_SIZE; y++) {
                const distFromCenter = Math.sqrt((x - hubX)**2 + (y - hubY)**2);
                const distFromHub = distFromCenter;
                const n = noise(x * 0.08, y * 0.08);
                const n2 = noise(x * 0.15 + 50, y * 0.15 + 50);
                const n3 = noise(x * 0.04, y * 0.04);
                
                let type = 'dirt';
                
                // Hub area — warm packed earth, cobblestone feeling
                if (distFromHub < HUB_SAFE_RADIUS - 3) {
                    type = 'hub_stone';
                } else if (distFromHub < HUB_SAFE_RADIUS - 1) {
                    type = 'hub_edge';
                }
                // The Verge — varied terrain
                else if (n > 0.5 && n2 > 0.3) {
                    type = 'deadgrass';
                } else if (n3 > 0.55 && distFromCenter < 42) {
                    type = 'path';
                } else if (n > 0.35) {
                    type = 'deadgrass';
                }
                
                // World edges dissolve into haze
                if (distFromCenter > 42) type = 'haze';
                
                this.tiles[x][y] = {
                    type,
                    shade: 0.9 + Math.random() * 0.1,
                    variation: Math.random(),
                    hazeAmount: Math.max(0, (distFromCenter - 38) / 12)
                };
            }
        }
        
                // Road & industrial mapping — procedural roads + concrete/asphalt patches
        // Create a few winding roads that occasionally widen into asphalt; add concrete pads for industrial clusters.
        const roadCount = 3;
        for (let r = 0; r < roadCount; r++) {
            const side = Math.floor(Math.random() * 4);
            let rx = side === 0 ? 0 : side === 1 ? WORLD_SIZE - 1 : Math.floor(Math.random() * WORLD_SIZE);
            let ry = side === 2 ? 0 : side === 3 ? WORLD_SIZE - 1 : Math.floor(Math.random() * WORLD_SIZE);
            const targetX = Math.floor(hubX + (Math.random() - 0.5) * WORLD_SIZE * 0.5);
            const targetY = Math.floor(hubY + (Math.random() - 0.5) * WORLD_SIZE * 0.5);
            const steps = 300 + Math.floor(Math.random() * 200);
            for (let i = 0; i < steps; i++) {
                const tx = Math.round(Math.max(0, Math.min(WORLD_SIZE - 1, rx)));
                const ty = Math.round(Math.max(0, Math.min(WORLD_SIZE - 1, ry)));
                if (this.tiles[tx] && this.tiles[tx][ty]) {
                    this.tiles[tx][ty].type = 'road';
                    for (let ox = -1; ox <= 1; ox++) {
                        for (let oy = -1; oy <= 1; oy++) {
                            const nx = tx + ox, ny = ty + oy;
                            if (nx >= 0 && nx < WORLD_SIZE && ny >= 0 && ny < WORLD_SIZE) {
                                if (Math.random() < 0.35) this.tiles[nx][ny].type = (Math.random() < 0.7 ? 'asphalt' : 'concrete');
                            }
                        }
                    }
                }
                rx += (targetX - rx) * 0.02 + (Math.random() - 0.5) * 0.8;
                ry += (targetY - ry) * 0.02 + (Math.random() - 0.5) * 0.8;
                if (Math.hypot(rx - targetX, ry - targetY) < 2) break;
            }
        }

        // Concrete industrial pads
        for (let p = 0; p < 6; p++) {
            const cx = Math.floor(Math.random() * WORLD_SIZE);
            const cy = Math.floor(Math.random() * WORLD_SIZE);
            const pr = 2 + Math.floor(Math.random() * 4);
            for (let xx = cx - pr; xx <= cx + pr; xx++) {
                for (let yy = cy - pr; yy <= cy + pr; yy++) {
                    if (xx >= 0 && xx < WORLD_SIZE && yy >= 0 && yy < WORLD_SIZE) {
                        if (Math.hypot(xx - cx, yy - cy) <= pr + 0.5) {
                            if (this.tiles[xx] && this.tiles[xx][yy] && Math.random() < 0.9) this.tiles[xx][yy].type = 'concrete';
                        }
                    }
                }
            }
        }

        // Scattered asphalt patches (e.g., worn road fragments)
        for (let x = 0; x < WORLD_SIZE; x++) {
            for (let y = 0; y < WORLD_SIZE; y++) {
                if (!this.tiles[x] || !this.tiles[x][y]) continue;
                if (this.tiles[x][y].type === 'dirt' && noise(x * 0.12, y * 0.12) > 0.65) {
                    this.tiles[x][y].type = Math.random() < 0.6 ? 'asphalt' : 'concrete';
                }
            }
        }

        // ---- Suburb block planner (tile-aligned) ----
        // Stamp repeating 8x8 suburban blocks across the map (skip the hub).
        const BLOCK_W = 8, BLOCK_H = 8;
        const houseDensity = 0.55; // chance to place a house at each candidate lot
        for (let bx = 0; bx < WORLD_SIZE; bx += BLOCK_W) {
            for (let by = 0; by < WORLD_SIZE; by += BLOCK_H) {
                // Skip blocks overlapping the hub
                const blockCenterX = bx + BLOCK_W / 2;
                const blockCenterY = by + BLOCK_H / 2;
                if (Math.hypot(blockCenterX - hubX, blockCenterY - hubY) < HUB_SAFE_RADIUS + 6) continue;

                // Local pattern (matches the Python sketch): vertical road at x=3, horizontal at y=4
                // Apply within world bounds
                for (let ly = 0; ly < BLOCK_H; ly++) {
                    const wx = bx + 3; const wy = by + ly;
                    if (wx >= 0 && wx < WORLD_SIZE && wy >= 0 && wy < WORLD_SIZE) {
                        if (this.tiles[wx] && this.tiles[wx][wy]) this.tiles[wx][wy].type = 'road';
                    }
                }
                for (let lx = 0; lx < BLOCK_W; lx++) {
                    const wx = bx + lx; const wy = by + 4;
                    if (wx >= 0 && wx < WORLD_SIZE && wy >= 0 && wy < WORLD_SIZE) {
                        if (this.tiles[wx] && this.tiles[wx][wy]) this.tiles[wx][wy].type = 'asphalt';
                    }
                }

                // Sidewalks (concrete) beside main roads
                for (let ly = 0; ly < BLOCK_H; ly++) {
                    for (const sx of [2, 4]) {
                        const wx = bx + sx; const wy = by + ly;
                        if (wx >= 0 && wx < WORLD_SIZE && wy >= 0 && wy < WORLD_SIZE && this.tiles[wx] && this.tiles[wx][wy]) {
                            const tt = this.tiles[wx][wy].type;
                            if (tt === 'dirt' || tt === 'deadgrass' || tt === 'path') this.tiles[wx][wy].type = 'concrete';
                        }
                    }
                }
                for (let lx = 0; lx < BLOCK_W; lx++) {
                    for (const sy of [3, 5]) {
                        const wx = bx + lx; const wy = by + sy;
                        if (wx >= 0 && wx < WORLD_SIZE && wy >= 0 && wy < WORLD_SIZE && this.tiles[wx] && this.tiles[wx][wy]) {
                            const tt = this.tiles[wx][wy].type;
                            if (tt === 'dirt' || tt === 'deadgrass' || tt === 'path') this.tiles[wx][wy].type = 'concrete';
                        }
                    }
                }

                // Concrete pads at the intersection corners
                const cornerPairs = [[3,2],[3,4],[5,2],[5,4]];
                for (const [cy, cx] of cornerPairs) {
                    const wx = bx + cx; const wy = by + cy;
                    if (wx >= 0 && wx < WORLD_SIZE && wy >= 0 && wy < WORLD_SIZE && this.tiles[wx] && this.tiles[wx][wy]) {
                        this.tiles[wx][wy].type = 'concrete';
                    }
                }

                // Dirt lots in the four corner districts of the block
                for (let y = 0; y <= 2; y++) for (let x = 0; x <= 1; x++) {
                    const wx = bx + x, wy = by + y;
                    if (wx >= 0 && wx < WORLD_SIZE && wy >= 0 && wy < WORLD_SIZE && this.tiles[wx] && this.tiles[wx][wy]) {
                        this.tiles[wx][wy].type = (Math.random() < 0.5) ? 'dirt' : 'deadgrass';
                    }
                }
                for (let y = 0; y <= 2; y++) for (let x = 5; x <= 7; x++) {
                    const wx = bx + x, wy = by + y;
                    if (wx >= 0 && wx < WORLD_SIZE && wy >= 0 && wy < WORLD_SIZE && this.tiles[wx] && this.tiles[wx][wy]) {
                        this.tiles[wx][wy].type = (Math.random() < 0.5) ? 'dirt' : 'deadgrass';
                    }
                }
                for (let y = 6; y <= 7; y++) for (let x = 0; x <= 1; x++) {
                    const wx = bx + x, wy = by + y;
                    if (wx >= 0 && wx < WORLD_SIZE && wy >= 0 && wy < WORLD_SIZE && this.tiles[wx] && this.tiles[wx][wy]) {
                        this.tiles[wx][wy].type = (Math.random() < 0.5) ? 'dirt' : 'deadgrass';
                    }
                }
                for (let y = 6; y <= 7; y++) for (let x = 5; x <= 7; x++) {
                    const wx = bx + x, wy = by + y;
                    if (wx >= 0 && wx < WORLD_SIZE && wy >= 0 && wy < WORLD_SIZE && this.tiles[wx] && this.tiles[wx][wy]) {
                        this.tiles[wx][wy].type = (Math.random() < 0.5) ? 'dirt' : 'deadgrass';
                    }
                }

                // Fill remaining empty-ish cells with concrete/dirt to tidy the block
                for (let lx = 0; lx < BLOCK_W; lx++) {
                    for (let ly = 0; ly < BLOCK_H; ly++) {
                        const wx = bx + lx; const wy = by + ly;
                        if (!(wx >= 0 && wx < WORLD_SIZE && wy >= 0 && wy < WORLD_SIZE)) continue;
                        const tt = this.tiles[wx][wy].type;
                        if (tt === 'deadgrass' || tt === 'path' || tt === 'dirt') {
                            this.tiles[wx][wy].type = (Math.random() < 0.45) ? 'concrete' : 'dirt';
                        }
                    }
                }

                // Helper: check free placement (avoid overlaps)
                const spotFree = (wx, wy) => {
                    if (wx < 0 || wx >= WORLD_SIZE || wy < 0 || wy >= WORLD_SIZE) return false;
                    if (!this.tiles[wx] || !this.tiles[wx][wy]) return false;
                    if (this.tiles[wx][wy].type === 'haze' || this.tiles[wx][wy].type === 'hub_stone') return false;
                    for (const s of this.structures) {
                        if (Math.hypot(s.x - (wx + 0.5), s.y - (wy + 0.5)) < 1.6) return false;
                    }
                    return true;
                };

                // Place houses clearly along street edges (outer-of-sidewalk positions)
                // Vertical road (local x=3) -> candidate house tiles at local x=1 and x=6
                for (let ly = 0; ly < BLOCK_H; ly++) {
                    const roadX = bx + 3, roadY = by + ly;
                    if (!(roadX >= 0 && roadX < WORLD_SIZE && roadY >= 0 && roadY < WORLD_SIZE)) continue;
                    const roadT = this.tiles[roadX][roadY].type;
                    if (roadT === 'road' || roadT === 'asphalt') {
                        const leftX = bx + 1; const rightX = bx + 6; const hy = by + ly;
                        if (Math.random() < houseDensity && spotFree(leftX, hy)) {
                            const asset = `house${1 + Math.floor(Math.random() * 3)}`;
                            this.structures.push({ x: leftX + 0.5 - 0.12, y: hy + 0.5, w: 2, h: 2, type: 'shack', label: 'House', asset });
                        }
                        if (Math.random() < houseDensity && spotFree(rightX, hy)) {
                            const asset = `house${1 + Math.floor(Math.random() * 3)}`;
                            this.structures.push({ x: rightX + 0.5 + 0.12, y: hy + 0.5, w: 2, h: 2, type: 'shack', label: 'House', asset });
                        }
                    }
                }

                // Horizontal road (local y=4) -> candidate house tiles at local y=2 and y=6
                for (let lx = 0; lx < BLOCK_W; lx++) {
                    const roadX = bx + lx, roadY = by + 4;
                    if (!(roadX >= 0 && roadX < WORLD_SIZE && roadY >= 0 && roadY < WORLD_SIZE)) continue;
                    const roadT = this.tiles[roadX][roadY].type;
                    if (roadT === 'road' || roadT === 'asphalt') {
                        const topY = by + 2; const botY = by + 6; const hx = bx + lx;
                        if (Math.random() < houseDensity && spotFree(hx, topY)) {
                            const asset = `house${1 + Math.floor(Math.random() * 3)}`;
                            this.structures.push({ x: hx + 0.5, y: topY + 0.5 - 0.12, w: 2, h: 2, type: 'shack', label: 'House', asset });
                        }
                        if (Math.random() < houseDensity && spotFree(hx, botY)) {
                            const asset = `house${1 + Math.floor(Math.random() * 3)}`;
                            this.structures.push({ x: hx + 0.5, y: botY + 0.5 + 0.12, w: 2, h: 2, type: 'shack', label: 'House', asset });
                        }
                    }
                }
            }
        }

        // ── HOLDFAST STRUCTURES — Larger settlement ──
        // Central chapel
        this.structures.push(
            { x: hubX - 1, y: hubY - 3, w: 5, h: 4, type: 'chapel', label: 'The Holdfast' },
        );
        // Residential / functional buildings spread around
        this.structures.push(
            { x: hubX - 7, y: hubY + 2, w: 3, h: 2, type: 'shack', label: 'Dwelling' },
            { x: hubX + 5, y: hubY - 4, w: 3, h: 3, type: 'barn', label: 'Storehouse' },
            { x: hubX - 5, y: hubY - 6, w: 3, h: 3, type: 'storehouse', label: 'Archive' },
            { x: hubX + 6, y: hubY + 3, w: 2, h: 2, type: 'shack', label: 'Workshop' },
            { x: hubX - 8, y: hubY - 3, w: 2, h: 2, type: 'shack', label: 'Hut' },
            { x: hubX + 3, y: hubY + 6, w: 3, h: 2, type: 'barn', label: 'Quarters' },
            { x: hubX - 3, y: hubY + 6, w: 2, h: 2, type: 'shack', label: 'Dwelling' },
            { x: hubX + 8, y: hubY - 1, w: 2, h: 3, type: 'storehouse', label: 'Armory' },
        );

        // G1.8 in-game acceptance scene. Enabled only with ?house-test=1.
        // s.x/s.y is the canonical House A ground anchor, not a top-left corner.
        if (HOUSE_G1_8_TEST) {
            this.structures.push({
                x: HOUSE_VARIANT_REVIEW ? reviewLayout(hubX,hubY).master.x : hubX + 10,
                y: HOUSE_VARIANT_REVIEW ? reviewLayout(hubX,hubY).master.y : hubY + 8,
                w: 3.75,
                h: 3.0,
                type: 'governedHouseA',
                asset: 'houseAG18Governed',
                label: '[G1.8 HOUSE TEST]',
                governedTest: true,
                governedSprite: {
                    logicalWidth: 512,
                    logicalHeight: 512,
                    anchorPixelX: 220,
                    anchorPixelY: 334,
                },
                collisionBounds: {
                    minX: -1.875,
                    maxX: 1.875,
                    minY: -3.0,
                    maxY: 0.0,
                },
            });
        }

        if (HOUSE_VARIANT_REVIEW && houseVariantMetadata) {
            const layout=reviewLayout(hubX,hubY);
            this.structures.push(variantStructure(houseVariantMetadata,layout.variant.x,layout.variant.y));
            const plots=this.structures.filter(s=>s.governedTest).map(structureBounds);
            this.structures=this.structures.filter(s=>s.governedTest || !plots.some(p=>{
                const b=structureBounds(s);
                return b.minX<p.maxX+1 && b.maxX>p.minX-1 && b.minY<p.maxY+1.5 && b.maxY>p.minY-1;
            }));
        }

        // Assign randomized house sprites for shack-type structures (house1..house3)
        for (const s of this.structures) {
            if (s.type === 'shack') {
                const n = 1 + Math.floor(Math.random() * 3);
                s.asset = `house${n}`;
                // Nudge shacks slightly outward from hub center so NPCs are not hidden behind them
                const dx = s.x - hubX;
                const dy = s.y - hubY;
                const dist = Math.max(0.001, Math.hypot(dx, dy));
                const pushFactor = 1.18; // moderate outward spacing
                s.x = hubX + dx / dist * (dist * pushFactor);
                s.y = hubY + dy / dist * (dist * pushFactor);
                // Slightly increase footprint to reduce overlap with nearby props/NPCs
                s.w = Math.max(s.w, 2);
                s.h = Math.max(s.h, 2);
            }
        }
        
        // Hub campfire — warm glow center  
        this.campfire = { x: hubX, y: hubY + 1 };
        
        // ── HUB WALL — Solid stone perimeter with gate ──
        const wallR = HUB_SAFE_RADIUS - 0.5;
        const wallSegCount = 80;
        const gateAngle = HUB_GATE_ANGLE;
        const gateHalfWidth = HUB_GATE_WIDTH;
        
        for (let i = 0; i < wallSegCount; i++) {
            const angle = (i / wallSegCount) * Math.PI * 2;
            
            // Leave a gap for the gate
            const angleDiff = Math.abs(((angle - gateAngle + Math.PI) % (Math.PI * 2)) - Math.PI);
            if (angleDiff < gateHalfWidth) continue;
            
            const wx = hubX + Math.cos(angle) * wallR;
            const wy = hubY + Math.sin(angle) * wallR;
            
            this.wallSegments.push({
                x: wx, y: wy,
                angle: angle,
                height: 1.8 + Math.random() * 0.4,
                damage: Math.random() * 0.3, // visual wear
                hasTorch: Math.random() < 0.08 // occasional torches
            });
        }
        
        for (let i=0; i<this.wallSegments.length; i++) {
            const current=this.wallSegments[i];
            const next=this.wallSegments[(i+1)%this.wallSegments.length];
            if (Math.hypot(next.x-current.x,next.y-current.y)<2) {
                current.end={x:next.x,y:next.y,height:next.height};
            }
        }

        // Gate markers — pillars flanking the exit
        const gL = gateAngle - gateHalfWidth;
        const gR = gateAngle + gateHalfWidth;
        this.gatePos = {
            x: hubX + Math.cos(gateAngle) * wallR,
            y: hubY + Math.sin(gateAngle) * wallR,
            leftPillar: { x: hubX + Math.cos(gL) * wallR, y: hubY + Math.sin(gL) * wallR },
            rightPillar: { x: hubX + Math.cos(gR) * wallR, y: hubY + Math.sin(gR) * wallR },
        };
        
        // ── NPCs — Characters with psychological dialogue ──
        this.npcs = [
            {
                id: 'keeper',
                name: 'The Keeper',
                x: hubX - 0.5, y: hubY - 1.5,
                facing: 1,
                color: '#4a3a2a',
                accent: 'rgba(120,90,40,0.6)',
                spriteKey: 'npcKeeper',
                dialogueIndex: 0,
                dialogues: [
                    "You came back. That's not strength — it's pattern. But pattern keeps you alive, so I won't judge.",
                    "The Verge doesn't want to kill you. It wants to fix you in place. That's worse.",
                    "The fire doesn't care about you. I do, but only because caring is what I do. Don't read into it.",
                    "Every husk out there was someone who found their answer. Remember that.",
                    "Rest if you need to. But notice when rest becomes avoidance."
                ]
            },
            {
                id: 'mender',
                name: 'Sable',
                x: hubX + 6.5, y: hubY - 1.5,
                facing: -1,
                color: '#3a2a3a',
                accent: 'rgba(100,70,120,0.6)',
                spriteKey: 'npcSable',
                dialogueIndex: 0,
                dialogues: [
                    "I can mend your blade, but the hand that holds it — that's your problem.",
                    "People ask me to fix things. But fixing implies something was right before. Was it?",
                    "Every weapon I sharpen goes back out there. I try not to think about what comes next.",
                    "Your integrity isn't armor. It's a process. Don't let it calcify.",
                    "Bring me something from the Burdened. Their remnants teach about weight."
                ]
            },
            {
                id: 'watcher',
                name: 'Veiled Oren',
                x: hubX - 7, y: hubY + 0.5,
                facing: 1,
                color: '#2a3a3a',
                accent: 'rgba(70,100,110,0.6)',
                spriteKey: 'npcOren',
                dialogueIndex: 0,
                dialogues: [
                    "I watch the wall. Not for what comes in — for what tries to leave and then stops.",
                    "The gate faces southeast. That's where the Verge is thickest. Coincidence? No. Architecture of fear.",
                    "I saw a Lingering almost reach the wall last night. It stopped. Turned. Even husks have patterns they can't break.",
                    "Your Greyline — I can see it, you know. Like heat shimmer. Try to keep it moving.",
                    "Restraint and compulsion... both are you. The wall around this place? It's both too."
                ]
            },
            {
                id: 'scholar',
                name: 'Harren',
                x: hubX - 4, y: hubY - 5,
                facing: 1,
                color: '#3a3a28',
                accent: 'rgba(110,100,60,0.6)',
                spriteKey: 'npcHarren',
                dialogueIndex: 0,
                dialogues: [
                    "The Archive contains what we remember. Which is to say, it contains our lies.",
                    "I've been studying the Remembered. They're not echoes. They're arguments — the dead insisting they were right.",
                    "Awareness isn't a gift. It's a wound that refuses to scar over. But it's necessary.",
                    "The Rehearsed frighten me most. Perfection as pathology. I see it in myself sometimes.",
                    "Read the commission they gave you again. Notice how the ink runs. Orders dissolving into ambiguity."
                ]
            },
            {
                id: 'drifter',
                name: 'Mara',
                x: hubX + 4, y: hubY + 5.5,
                facing: -1,
                color: '#383028',
                accent: 'rgba(100,80,60,0.6)',
                dialogueIndex: 0,
                dialogues: [
                    "I used to be out there. Not as a hunter — as a drifter. Funny how thin the line is.",
                    "The Holdfast is warm. Warm is good. Warm also makes you slow. Don't get slow.",
                    "Kill enough husks and you start to wonder — are you clearing a path, or just... reacting?",
                    "Burden isn't just weight. It's accumulation of consequence. Every action leaves residue.",
                    "I came back because staying out there forever is its own kind of fixation."
                ]
            },
        ];
        
        // ── Crooked fence lines — only outside hub ──
        for (let i = 0; i < 20; i++) {
            const startX = 8 + Math.random() * 84;
            const startY = 8 + Math.random() * 84;
            const fd = Math.sqrt((startX - hubX)**2 + (startY - hubY)**2);
            if (fd < HUB_SAFE_RADIUS + 4) continue;
            const angle = Math.random() * Math.PI;
            const len = 3 + Math.random() * 8;
            for (let j = 0; j < len; j++) {
                this.fencePosts.push({
                    x: startX + Math.cos(angle) * j + (Math.random() - 0.5) * 0.3,
                    y: startY + Math.sin(angle) * j + (Math.random() - 0.5) * 0.3,
                    lean: (Math.random() - 0.5) * 0.4,
                    height: 0.6 + Math.random() * 0.4
                });
            }
        }
        
        // Haze pools — only in the Verge, not hub
        for (let i = 0; i < 35; i++) {
            const hx = 5 + Math.random() * 90;
            const hy = 5 + Math.random() * 90;
            const hd = Math.sqrt((hx - hubX)**2 + (hy - hubY)**2);
            if (hd < HUB_SAFE_RADIUS + 3) continue;
            this.hazePools.push({
                x: hx, y: hy,
                radius: 2 + Math.random() * 4,
                density: 0.3 + Math.random() * 0.4,
                pulse: Math.random() * Math.PI * 2
            });
        }
        
        // Tired trees that lean — never inside hub
        for (let i = 0; i < 55; i++) {
            const tx = 5 + Math.random() * 90;
            const ty = 5 + Math.random() * 90;
            const td = Math.sqrt((tx - hubX)**2 + (ty - hubY)**2);
            if (td < HUB_SAFE_RADIUS + 2) continue;
            this.trees.push({
                x: tx, y: ty,
                lean: (Math.random() - 0.5) * 0.3,
                height: 1.5 + Math.random() * 1.5,
                bare: Math.random() > 0.25
            });
        }
        
        // ── ENVIRONMENTAL PROPS — Sprite-based world objects ──
        // Dead trees (large sprite props)
        for (let i = 0; i < 30; i++) {
            const px = 6 + Math.random() * 88;
            const py = 6 + Math.random() * 88;
            const pd = Math.sqrt((px - hubX)**2 + (py - hubY)**2);
            if (pd < HUB_SAFE_RADIUS + 3) continue;
            if (pd > 43) continue; // not beyond haze
            this.props.push({
                x: px, y: py,
                type: Math.random() > 0.5 ? 'deadTree1' : 'deadTree2',
                scale: 0.6 + Math.random() * 0.5,
                flip: Math.random() > 0.5,
                zOffset: -30 // draw above ground
            });
        }
        
        // Broken fence sections
        for (let i = 0; i < 12; i++) {
            const px = 8 + Math.random() * 84;
            const py = 8 + Math.random() * 84;
            const pd = Math.sqrt((px - hubX)**2 + (py - hubY)**2);
            if (pd < HUB_SAFE_RADIUS + 4) continue;
            if (pd > 40) continue;
            this.props.push({
                x: px, y: py,
                type: 'brokenFence',
                scale: 0.45 + Math.random() * 0.3,
                flip: Math.random() > 0.5,
                zOffset: -10
            });
        }
        
        // Stone ruins scattered
        for (let i = 0; i < 8; i++) {
            const px = 10 + Math.random() * 80;
            const py = 10 + Math.random() * 80;
            const pd = Math.sqrt((px - hubX)**2 + (py - hubY)**2);
            if (pd < HUB_SAFE_RADIUS + 5) continue;
            if (pd > 38) continue;
            this.props.push({
                x: px, y: py,
                type: 'stoneRuin',
                scale: 0.5 + Math.random() * 0.4,
                flip: Math.random() > 0.5,
                zOffset: -15
            });
        }
        
        // Ground rock clusters
        for (let i = 0; i < 20; i++) {
            const px = 5 + Math.random() * 90;
            const py = 5 + Math.random() * 90;
            const pd = Math.sqrt((px - hubX)**2 + (py - hubY)**2);
            if (pd < HUB_SAFE_RADIUS + 2) continue;
            if (pd > 42) continue;
            this.props.push({
                x: px, y: py,
                type: 'groundRocks',
                scale: 0.25 + Math.random() * 0.25,
                flip: Math.random() > 0.5,
                zOffset: -3
            });
        }
        
        // Collapsed barns — rare, large
        for (let i = 0; i < 4; i++) {
            const angle = Math.PI * 0.5 * i + Math.random() * 0.8;
            const dist = 20 + Math.random() * 12;
            const px = hubX + Math.cos(angle) * dist;
            const py = hubY + Math.sin(angle) * dist;
            this.props.push({
                x: px, y: py,
                type: 'collapsedBarn',
                scale: 0.65 + Math.random() * 0.25,
                flip: Math.random() > 0.5,
                zOffset: -25
            });
        }
        
        // ── NEW ENVIRONMENT PROPS — Fill the world ──
        
        // Old wells — scattered, rare
        for (let i = 0; i < 5; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 18 + Math.random() * 16;
            const px = hubX + Math.cos(angle) * dist;
            const py = hubY + Math.sin(angle) * dist;
            this.props.push({ x: px, y: py, type: 'oldWell', scale: 0.45 + Math.random() * 0.2, flip: Math.random() > 0.5, zOffset: -15 });
        }
        
        // Overturned wooden carts
        for (let i = 0; i < 8; i++) {
            const px = 10 + Math.random() * 80;
            const py = 10 + Math.random() * 80;
            const pd = Math.sqrt((px - hubX)**2 + (py - hubY)**2);
            if (pd < HUB_SAFE_RADIUS + 3 || pd > 40) continue;
            this.props.push({ x: px, y: py, type: 'woodenCart', scale: 0.4 + Math.random() * 0.25, flip: Math.random() > 0.5, zOffset: -8 });
        }
        
        // Grave marker clusters — eerie
        for (let i = 0; i < 6; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 16 + Math.random() * 18;
            const px = hubX + Math.cos(angle) * dist;
            const py = hubY + Math.sin(angle) * dist;
            this.props.push({ x: px, y: py, type: 'graveMarkers', scale: 0.35 + Math.random() * 0.2, flip: Math.random() > 0.5, zOffset: -10 });
        }
        
        // Dead bushes — very common, fill gaps
        for (let i = 0; i < 40; i++) {
            const px = 5 + Math.random() * 90;
            const py = 5 + Math.random() * 90;
            const pd = Math.sqrt((px - hubX)**2 + (py - hubY)**2);
            if (pd < HUB_SAFE_RADIUS + 2 || pd > 43) continue;
            this.props.push({ x: px, y: py, type: 'deadBush', scale: 0.2 + Math.random() * 0.25, flip: Math.random() > 0.5, zOffset: -4 });
        }
        
        // Old signposts — rare landmarks
        for (let i = 0; i < 4; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 14 + Math.random() * 20;
            const px = hubX + Math.cos(angle) * dist;
            const py = hubY + Math.sin(angle) * dist;
            this.props.push({ x: px, y: py, type: 'oldSignpost', scale: 0.4 + Math.random() * 0.15, flip: Math.random() > 0.5, zOffset: -12 });
        }
        
        // Hay piles — farm debris
        for (let i = 0; i < 10; i++) {
            const px = 8 + Math.random() * 84;
            const py = 8 + Math.random() * 84;
            const pd = Math.sqrt((px - hubX)**2 + (py - hubY)**2);
            if (pd < HUB_SAFE_RADIUS + 4 || pd > 38) continue;
            this.props.push({ x: px, y: py, type: 'hayPile', scale: 0.3 + Math.random() * 0.2, flip: Math.random() > 0.5, zOffset: -6 });
        }
        
        // Skull piles — near enemy-heavy zones, further out
        for (let i = 0; i < 8; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 22 + Math.random() * 14;
            const px = hubX + Math.cos(angle) * dist;
            const py = hubY + Math.sin(angle) * dist;
            this.props.push({ x: px, y: py, type: 'skullPile', scale: 0.25 + Math.random() * 0.15, flip: Math.random() > 0.5, zOffset: -3 });
        }
        
        // Lantern posts — hub perimeter and inside hub for warmth
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const dist = HUB_SAFE_RADIUS - 3;
            const px = hubX + Math.cos(angle) * dist;
            const py = hubY + Math.sin(angle) * dist;
            this.props.push({ x: px, y: py, type: 'lanternPost', scale: 0.5 + Math.random() * 0.1, flip: false, zOffset: -20 });
        }
        
        const placedProps = [];
        for (const prop of this.props) {
            const radius = prop.collisionRadius ?? 0.6 * (prop.scale || 1);
            if (HOUSE_VARIANT_REVIEW && !placementClear(prop.x,prop.y,this.structures.filter(s=>s.governedTest),3)) continue;
            if (!placementClear(prop.x, prop.y, this.structures, radius)) continue;
            if (placedProps.some(p => Math.hypot(p.x-prop.x, p.y-prop.y) < radius + (p.collisionRadius ?? 0.6*(p.scale || 1)))) continue;
            placedProps.push(prop);
        }
        this.props = placedProps;
        // Relocate authored NPCs locally instead of leaving them inside a new building.
        for (const npc of this.npcs) {
            if (!isBlockedAt(npc.x, npc.y) && placementClear(npc.x,npc.y,this.structures,0.3)) continue;
            const origin = {x:npc.x,y:npc.y};
            let placed = false;
            for (let r=0.5; r<=8 && !placed; r+=0.5) {
                for (let i=0; i<16; i++) {
                    const x=origin.x+Math.cos(i*Math.PI/8)*r;
                    const y=origin.y+Math.sin(i*Math.PI/8)*r;
                    if (Math.hypot(x-hubX,y-hubY)>=HUB_SAFE_RADIUS-1) continue;
                    if (isBlockedAt(x,y) || !placementClear(x,y,this.structures,0.3)) continue;
                    npc.x=x; npc.y=y; placed=true; break;
                }
            }
        }

        // ── PERSISTENT FOG — Atmospheric ground haze ──
        for (let i = 0; i < 50; i++) {
            const fx = 5 + Math.random() * 90;
            const fy = 5 + Math.random() * 90;
            this.fogParticles.push({
                    x: fx, y: fy,
                    baseX: fx, baseY: fy,
                    size: 4 + Math.random() * 8,
                    speed: 0.03 + Math.random() * 0.06,
                    phase: Math.random() * Math.PI * 2,
                    // stronger base opacity so fog reads on most displays
                    opacity: 0.06 + Math.random() * 0.12
                });
        }

        // Haze pools (UNREVEALED seep) — visible, world-space patches that intensify with Greyline.
        // These are not "danger zones" by themselves; they are a perceptual medium.
        this.hazePools = [];
        const poolCount = 22; // enough to be felt, not a blanket
        for (let i = 0; i < poolCount; i++) {
            const hx = 6 + Math.random() * 88;
            const hy = 6 + Math.random() * 88;
            const d = Math.hypot(hx - hubX, hy - hubY);
            // Avoid stacking inside the safe hub ring
            if (d < HUB_SAFE_RADIUS - 2) { i--; continue; }
            this.hazePools.push({
                x: hx, y: hy,
                radius: 2.5 + Math.random() * 5.5,   // in tiles (scaled in render)
                density: 0.06 + Math.random() * 0.10, // base opacity
                pulse: Math.random() * Math.PI * 2
            });
        }

        
        // ── AMBIENT LEAVES — Dead leaves drifting on the wind ──
        for (let i = 0; i < 30; i++) {
            this.ambientLeaves.push({
                x: Math.random() * WORLD_SIZE,
                y: Math.random() * WORLD_SIZE,
                vx: 0.3 + Math.random() * 0.5,
                vy: 0.1 + Math.random() * 0.3,
                rot: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 3,
                size: 1.5 + Math.random() * 2.5,
                phase: Math.random() * Math.PI * 2,
                opacity: 0.3 + Math.random() * 0.35,
                color: Math.random() < 0.5 ? '#5a4030' : (Math.random() < 0.5 ? '#4a3a25' : '#6a4a2a'),
                flutter: 0.5 + Math.random() * 1.5,
            });
        }
        
        // ── AMBIENT DUST — Floating motes of ash/dust ──
        for (let i = 0; i < 40; i++) {
            this.ambientDust.push({
                x: Math.random() * WORLD_SIZE,
                y: Math.random() * WORLD_SIZE,
                size: 0.5 + Math.random() * 1.5,
                phase: Math.random() * Math.PI * 2,
                speed: 0.01 + Math.random() * 0.03,
                opacity: 0.15 + Math.random() * 0.25,
                drift: Math.random() * 0.2,
            });
        }
    }
};

// Simple noise function
function noise(x, y) {
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return n - Math.floor(n);
}

// ============================================================
// PLAYER — ALIZA, HUSK HUNTER
// Not a hero. A process refusing fixation.
// ============================================================
const player = {
    x: WORLD_SIZE / 2,
    y: WORLD_SIZE / 2 + 2,
    vx: 0, vy: 0,
    speed: 3.5,
    health: 100,
    maxHealth: 100,
    stamina: 100,
    maxStamina: 100,
    burden: 20,
    maxBurden: 100,
    facing: 1,
    moveAngle: 0,          // raw movement angle in radians
    facingDir: 2,          // 8-direction index: 0=N, 1=NE, 2=E, 3=SE, 4=S, 5=SW, 6=W, 7=NW
    attackAngle: 0,        // angle toward mouse target at attack time
    state: 'idle', // idle, moving, attacking, dashing, attune, reclaiming
    attackTimer: 0,
    attackCooldown: 0,
    // Gun (ranged) — right click
    gunCooldown: 0,
    gunFireRate: 0.32,      // base seconds between shots (modulated by greyline) — slightly slower to reduce rapid fire chances
    ammo: 12,
    maxAmmo: 12,
    potions: 0,
    maxPotions: 5,
    reloadTimer: 0,
    reloading: false,
    dashTimer: 0,
    dashDirX: 0,
    dashDirY: 0,
    invulnTimer: 0,
    comboCount: 0,
    comboTimer: 0,
    attuneTimer: 0,
    attuneUseCount: 0,     // Overuse tracking — attunement as escape
    attuneWindowTimer: 0,  // Window for tracking overuse
    snarePlaced: [],
    snareUseCount: 0,      // Diminishing returns tracker
    reclaimZones: [],      // Reclamation active zones
    shadowTimer: 0,
    shadowActive: false,
    shadowDenialTimer: 0,  // If shadow is denied, it leaks anyway
    lastActionTime: 0,
    actionCount: 0,
    inactivityTimer: 0,
    lastSkillTime: 0,      // When was the last skill used?
    
    // Skill cooldowns — 6 skills
    cooldowns: {
        predatory: 0,    // 1: Predatory Motion
        snare: 0,        // 2: Adaptive Snare
        reclaim: 0,      // 3: Reclamation
        attune: 0,       // 4: Attunement
        burdenShift: 0,  // 5: Burden Shift
        shadow: 0,       // 6: Shadow Acknowledgement
    },
    // Skill input commitment / cancellation (subtle, Greyline-driven)
    actionState: {
        active: null,   // { key, fn, windup, recover, elapsed, committed, cancelUntil }
        queued: null,
        _moveSmooth: { x: 0, y: 0 },

},

    // Movement smoothing cache (must be top-level on the player object)
    _moveSmooth: { x: 0, y: 0 },
    // Request a skill via the commitment layer (do NOT call skill methods directly from input)
    requestSkill(skillKey, fn, baseWindup = 0.06, baseRecover = 0.10) {
        const ctl = greyline?.knobs?.ctl || { cancelRel: 1.0, commitBias: 0.0 };
        // Compulsion tends to "commit early" (a touch more windup) and reduces cancel reliability
        const windup = Math.max(0.02, baseWindup * (1 + Math.max(0, ctl.commitBias) * 0.35));
        const recover = Math.max(0.03, baseRecover * (1 - Math.min(0, ctl.commitBias) * 0.20));
        const cancelWindow = Math.max(0.015, windup * (0.15 + 0.65 * ctl.cancelRel));

        const req = { key: skillKey, fn, windup, recover, elapsed: 0, committed: false, cancelUntil: cancelWindow };
        const a = this.actionState.active;

        if (!a) {
            this.actionState.active = req;
            return;
        }

        // If still in cancel window, replace immediately; otherwise queue (lock-in feel)
        if (!a.committed && a.elapsed <= a.cancelUntil) {
            this.actionState.active = req;
        } else {
            this.actionState.queued = req;
        }
    },

    consumePotion() {
        if (!this.potions || this.potions <= 0) return;
        const heal = 30;
        this.health = Math.min(this.maxHealth, this.health + heal);
        this.potions = Math.max(0, this.potions - 1);
        // Healing gives a small restraint nudge (matches pickup behaviour)
        try { greyline.push(-1, 0.008); } catch (e) { /* ignore */ }
        particles.push({ x: this.x, y: this.y, vx: 0, vy: -1.0, type: 'insight_text', timer: 1.2, text: `+${heal} HP`, size: 11, color: 'rgba(130,200,100,0.9)' });
        playPickupSound('health');
    },

    _updateSkillCommit(dt) {
        const a = this.actionState.active;
        if (!a) return;

        a.elapsed += dt;
        if (!a.committed && a.elapsed >= a.windup) {
            a.committed = true;
            a.fn();
        }

        if (a.elapsed >= (a.windup + a.recover)) {
            this.actionState.active = null;
            if (this.actionState.queued) {
                this.actionState.active = this.actionState.queued;
                this.actionState.queued = null;
            }
        }
    },

    
    // Skill use frequency for diminishing returns / decay
    skillUsage: {
        predatory: 0,
        snare: 0,
        reclaim: 0,
        attune: 0,
        burdenShift: 0,
        shadow: 0,
    },
    
    update(dt) {
        // Commit layer: executes queued skills with Greyline-shaped windup/recover
        this._updateSkillCommit(dt);

        const agencyMod = psychStats.agency.value;
        const precisionMod = psychStats.precision.value;
        const greyDist = greyline.getDistance();
        const greyExtr = greyline.getExtremity();
        
        // ── COMPUTE EQUIPMENT BONUSES ──
        computeEquipBonuses();
        
        // Apply max health bonus from equipment
        const baseMaxHealth = 100 + (progression.passiveUpgrades?.vitality?.level || 0) * 10;
        this.maxHealth = baseMaxHealth + equipBonuses.healthBonus;
        if (this.health > this.maxHealth) this.health = this.maxHealth;
        
        // ── HEALTH REGEN from equipment ──
        if (equipBonuses.healthRegen > 0 && this.health < this.maxHealth) {
            this.health = Math.min(this.maxHealth, this.health + equipBonuses.healthRegen * dt);
        }
        
        // ── STAMINA REGEN — affected by Greyline + equipment ──
        if (this.state !== 'dashing' && this.state !== 'attacking') {
            let regenRate = 15;
            if (greyline.isBalanced()) regenRate = 18; // Balance reward
            regenRate *= (1 - greyExtr * 0.4) * (greyline.knobs?.eco?.stamRegen ?? 1.0); // Extremes slow regen
            regenRate *= (1 + equipBonuses.staminaRegen); // Equipment bonus
            this.stamina = Math.min(this.maxStamina, this.stamina + regenRate * dt);
        }
        
        // ── COOLDOWN UPDATES ──
        const adaptMod = psychStats.adaptability.value;
        const cdReduction = 1 + equipBonuses.cooldownReduction;
        for (const key in this.cooldowns) {
            // Adaptability + equipment speeds cooldown recovery
            this.cooldowns[key] = Math.max(0, this.cooldowns[key] - dt * (0.8 + adaptMod * 0.4) * cdReduction);
        }
        
        // ── GREYLINE STABILITY from equipment ──
        if (equipBonuses.greylineStability > 0) {
            greyline.momentum *= (1 - equipBonuses.greylineStability * dt * 0.5);
        }
        
        // Skill usage decay — overuse fades over time
        for (const key in this.skillUsage) {
            this.skillUsage[key] = Math.max(0, this.skillUsage[key] - dt * 0.08);
        }
        
        // Invuln timer
        this.invulnTimer = Math.max(0, this.invulnTimer - dt);
        // Melee attack cooldown (was missing) — decrement per-frame so player can attack again
        this.attackCooldown = Math.max(0, this.attackCooldown - dt);
        // Gun timers
        this.gunCooldown = Math.max(0, this.gunCooldown - dt);
        // Temporary timer used to show gun-attack test sprites (decrements here)
        this._gunSpriteTimer = Math.max(0, (this._gunSpriteTimer || 0) - dt);
        if (this.reloading) {
            this.reloadTimer -= dt * (greyline.knobs?.timeScale ?? 1.0); // time perception tint
            if (this.reloadTimer <= 0) {
                this.reloading = false;
                this.ammo = this.maxAmmo;
                if (audioEngine) audioEngine.playReloadComplete();
            }
        }
        
        // Combo timer
        this.comboTimer = Math.max(0, this.comboTimer - dt);
        if (this.comboTimer <= 0) this.comboCount = 0;
        
        // Attune overuse window
        this.attuneWindowTimer = Math.max(0, this.attuneWindowTimer - dt);
        if (this.attuneWindowTimer <= 0) this.attuneUseCount = Math.max(0, this.attuneUseCount - 1);
        
        // ── SHADOW DENIAL — if you never use shadow, it leaks ──
        if (!this.shadowActive && this.cooldowns.shadow <= 0) {
            this.shadowDenialTimer += dt;
            if (this.shadowDenialTimer > 30) {
                // Shadow leaks — subtle compulsion drift, visual distortion
                greyline.push(1, 0.003 * dt);
                psychStats.integrity.value -= 0.002 * dt;
                // Micro visual leak handled in rendering
            }
        }
        
        // Attack timer
        if (this.attackTimer > 0) {
            this.attackTimer -= dt;
            if (this.attackTimer <= 0) this.state = 'idle';
        }
        
        // ── PREDATORY MOTION (Dash) ──
        if (this.dashTimer > 0) {
            this.dashTimer -= dt;
            // Speed modified by agency and greyline state
            let dashSpeed = 12 * agencyMod;
            const side = greyline.getSide();
            if (side === 'restraint') {
                dashSpeed *= 0.7; // Cautious short hop
            } else if (side === 'compulsion') {
                dashSpeed *= 1.3; // Overcommit lunge
            }
            
            this.x += this.dashDirX * dashSpeed * dt;
            this.y += this.dashDirY * dashSpeed * dt;
            
            // Deal bleed damage to enemies passed through
            for (const enemy of adaptiveArray(enemies)) {
                if (enemy.dead || enemy._dashHit) continue;
                const dx = enemy.x - this.x;
                const dy = enemy.y - this.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < 1.2 * 1.2) {
                    const bleedDmg = 8 * precisionMod * (this.shadowActive ? 1.8 : 1.0);
                    enemy.takeDamage(bleedDmg, this.x, this.y);
                    enemy._dashHit = true;
                    // Trail blood particles
                    for (let i = 0; i < 3; i++) {
                        particles.push({
                            x: enemy.x, y: enemy.y,
                            vx: (Math.random() - 0.5) * 2,
                            vy: (Math.random() - 0.5) * 2,
                            type: 'blood', timer: 0.4,
                            size: 2, color: '#4a1a15'
                        });
                    }
                }
            }
            
            if (this.dashTimer <= 0) {
                this.state = 'idle';
                this.invulnTimer = 0;
                // Clear dash hit flags
                for (const e of enemies) e._dashHit = false;
            }
            return;
        }
        
        // ── ATTUNEMENT (Stillness) ──
        if (this.attuneTimer > 0) {
            this.attuneTimer -= dt;
            
            // Pull greyline toward center — the stabilisation effect
            const centerPull = greyline.value > 0.5 ? -1 : 1;
            greyline.push(centerPull, 0.025 * dt);
            
            // Awareness boost
            psychStats.awareness.value = Math.min(1, psychStats.awareness.value + 0.08 * dt);
            
            // BUT: overuse causes paralysis — diminishing returns
            if (this.attuneUseCount > 2) {
                // Paralysis — greyline moves TOWARD restraint instead of center
                greyline.push(-1, 0.01 * this.attuneUseCount * dt);
                psychStats.agency.value -= 0.01 * dt * this.attuneUseCount;
            }
            
            // Reveal enemy intent — show telegraph ranges briefly
            for (const e of enemies) {
                if (!e.dead) e._attuneRevealed = this.attuneTimer;
            }
            
            if (this.attuneTimer <= 0) this.state = 'idle';
            return;
        }
        
        // ── SHADOW ACKNOWLEDGEMENT active ──
        if (this.shadowActive) {
            this.shadowTimer -= dt;
            this.burden = Math.min(this.maxBurden, this.burden + 6 * dt);
            greyline.push(1, 0.025 * dt);
            
            // At greyline extremes, shadow behaves differently
            const side = greyline.getSide();
            if (side === 'restraint') {
                // Fizzles — reduced effectiveness
                this.shadowTimer -= dt * 0.5; // burns out faster
            } else if (side === 'compulsion') {
                // Loss of agency — controls become sluggish/delayed
                psychStats.agency.value -= 0.02 * dt;
                if (greyline.getExtremity() > 0.5) {
                    // Possession risk visualized: use camera shake / VFX instead
                    // (remove involuntary direct player velocity nudges)
                    try { camera.addShake(3 * greyline.getExtremity()); } catch (e) { /* ignore */ }
                }
            }
            // In the greyline zone: terrifying, precise power (no penalty)
            
            if (this.shadowTimer <= 0 || this.burden >= this.maxBurden) {
                this.shadowActive = false;
                this.shadowDenialTimer = 0; // Reset denial timer
            }
        }
        
        // ── RECLAMATION ZONES ──
        this.reclaimZones = this.reclaimZones.filter(z => z.timer > 0);
        for (const zone of this.reclaimZones) {
            zone.timer -= dt;
            zone.age += dt;
            zone.pulse = (zone.pulse || 0) + dt * 2;
            
            // Zone grows over time — reshapes the fight, doesn't burst
            const growthRate = greyline.getSide() === 'restraint' ? 0.15 :
                             greyline.getSide() === 'compulsion' ? 0.6 : 0.3;
            zone.radius = Math.min(zone.maxRadius, zone.radius + growthRate * dt);
            
            // Compulsion growth is unstable — radius jitters (clamp afterwards to be defensive)
            if (greyline.getSide() === 'compulsion') {
                zone.radius += Math.sin(TIME.elapsed * 5) * 0.1;
            }
            // Prevent tiny/negative radii from propagating into render math
            zone.radius = Math.max(0.05, zone.radius);
            
            // Damage enemies inside — slow, persistent, not burst
            for (const e of enemies) {
                if (e.dead) continue;
                const dx = e.x - zone.x;
                const dy = e.y - zone.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < zone.radius * zone.radius) {
                    // Slow + DoT
                    e.snaredSlowTimer = Math.max(e.snaredSlowTimer, 0.5);
                    if (zone.age > 1) { // Takes time to activate
                        e.health -= 2 * dt * precisionMod;
                        // Root/fungus visual
                        if (Math.random() < 0.1) {
                            particles.push({
                                x: e.x + (Math.random() - 0.5), y: e.y + (Math.random() - 0.5),
                                vx: 0, vy: -0.3,
                                type: 'reclaim_spore', timer: 0.8 + Math.random() * 0.5,
                                size: 1.5 + Math.random() * 2
                            });
                        }
                    }
                }
            }
        }
        
        // ── SNARES ──
        this.snarePlaced = this.snarePlaced.filter(s => s.timer > 0);
        for (const snare of this.snarePlaced) {
            snare.timer -= dt;
            snare.pulse = (snare.pulse || 0) + dt * 3;
        }
        
        // ── INACTIVITY → greyline drifts toward restraint ──
        this.inactivityTimer += dt;
        if (this.inactivityTimer > 3) {
            greyline.push(-1, 0.005 * dt);
        }

        // ── HAZE HIDING — wait in a haze pool still and enemies begin to disengage; nudges restraint
        this._hideInFogTimer = this._hideInFogTimer || 0;
        let _inHaze = false;
        if (world && world.hazePools && world.hazePools.length) {
            for (const p of world.hazePools) {
                const dx = this.x - p.x, dy = this.y - p.y;
                if (dx*dx + dy*dy < (p.radius || 0) * (p.radius || 0)) { _inHaze = true; break; }
            }
        }
        const _speed = Math.sqrt((this.vx||0)**2 + (this.vy||0)**2);
        if (_inHaze && _speed < 0.08 && this.state !== 'attacking' && this.state !== 'dashing') {
            this._hideInFogTimer = Math.min(6, this._hideInFogTimer + dt);
        } else {
            this._hideInFogTimer = Math.max(0, this._hideInFogTimer - dt * 1.5);
        }
        if (this._hideInFogTimer > 3.0) {
            // gentle, continuous restraint pull while hiding
            greyline.push(-1, 0.004 * dt);
            if (Math.random() < 0.06) particles.push({ x: this.x + (Math.random()-0.5)*0.6, y: this.y + (Math.random()-0.5)*0.6, vx: 0, vy: -0.2, type: 'haze_hide', timer: 0.9, size: 1.3 });
        }
        
        // ── MOVEMENT with agency modification ──
        if (this.state !== 'attacking' && this.state !== 'attune' && this.state !== 'reclaiming') {
            let mx = 0, my = 0;
            const side = greyline.getSide();
            
            // Agency shapes how inputs feel
            let inputMod = 1.0;
            if (side === 'restraint') {
                // Heavy, delayed — but precise
                inputMod = 0.55 + agencyMod * 0.45;
            } else if (side === 'compulsion') {
                // Twitchy, over-responsive
                inputMod = 0.95 + (1 - agencyMod) * 0.35;
                // Micro-jitter at high compulsion
                if (greyline.getExtremity() > 0.4) {
                    // Remove direct input jitter to avoid involuntary movement.
                    // Provide non-physical feedback via camera shake instead.
                    try { camera.addShake(1.2 * greyline.getExtremity()); } catch (e) { /* ignore */ }
                }
            }
            
            // Isometric-corrected controls:
            // W = screen up = world NW (-x, -y), S = screen down = world SE (+x, +y)
            // A = screen left = world SW (-x, +y), D = screen right = world NE (+x, -y)
            if (input.keys['w'] || input.keys['arrowup'])    { mx -= 1; my -= 1; }
            if (input.keys['s'] || input.keys['arrowdown'])  { mx += 1; my += 1; }
            if (input.keys['a'] || input.keys['arrowleft'])  { mx -= 1; my += 1; }
            if (input.keys['d'] || input.keys['arrowright']) { mx += 1; my -= 1; }
            
            if (mx !== 0 || my !== 0) {
                const len = Math.sqrt(mx * mx + my * my);
                mx /= len; my /= len;
              
                // Greyline control feel: damping + subtle jitter (interpretive, not punitive)
                const ctl = greyline?.knobs?.ctl || { damping: 0.15, jitter: 0.0 };
                const lerp = (a,b,t)=>a+(b-a)*t;
                const damp = Math.max(0.05, Math.min(0.75, ctl.damping));
                this._moveSmooth.x = lerp(this._moveSmooth.x, mx, 1 - damp);
                this._moveSmooth.y = lerp(this._moveSmooth.y, my, 1 - damp);
                mx = this._moveSmooth.x; my = this._moveSmooth.y;
                // jitter = slight phase wobble (compulsion), never full random loss of control
                const jit = Math.max(0, Math.min(0.6, ctl.jitter));
                if (jit > 0.001) {
                    mx += Math.sin(gameTime * 11.7) * jit * 0.05;
                    my += Math.cos(gameTime * 13.1) * jit * 0.05;
                }

                const ts = (greyline.knobs?.timeScale ?? 1.0);
                this.vx = mx * this.speed * inputMod * ts;
                this.vy = my * this.speed * inputMod * ts;
                this.state = 'moving';
                this.facing = mx >= 0 ? 1 : -1;
                this.inactivityTimer = 0;
                
                // 8-directional facing from SCREEN direction, not world
                // Convert world movement to screen space for sprite selection
                const screenDir = worldToScreen(mx, my);
                // Negate X to correct left/right mirror in isometric projection
                const screenAngle = Math.atan2(screenDir.y, -screenDir.x);
                const angle = Math.atan2(my, mx);
                this.moveAngle = angle;
                this.facingDir = angleToDir8(screenAngle);
                psychStats.recordMovementDirection(angle);
                
                // Footstep SFX — timed to movement speed
                this._footTimer = (this._footTimer || 0) + dt * (greyline.knobs?.timeScale ?? 1.0);
                const footInterval = greyline.getSide() === 'compulsion' ? 0.25 : greyline.getSide() === 'restraint' ? 0.45 : 0.35;
                if (this._footTimer >= footInterval) {
                    this._footTimer = 0;
                    if (audioEngine) audioEngine.playFootstep();
                }
                
                greyline.push(1, 0.002 * dt);
            } else {
                this.vx *= 0.8;
                this.vy *= 0.8;
                if (Math.abs(this.vx) < 0.1 && Math.abs(this.vy) < 0.1) {
                    this.state = this.state === 'moving' ? 'idle' : this.state;
                }
            }
            
            // Move with per-axis collision resolution so the player slides along obstacles
            const _prevX = this.x, _prevY = this.y;
            this.x += this.vx * dt;
            if (isBlockedAt(this.x, this.y)) this.x = _prevX;
            this.y += this.vy * dt;
            if (isBlockedAt(this.x, this.y)) this.y = _prevY;
        }
        
        // Clamp to world
        this.x = Math.max(2, Math.min(WORLD_SIZE - 2, this.x));
        this.y = Math.max(2, Math.min(WORLD_SIZE - 2, this.y));
        
        // Collision handled by isBlockedAt(...) above — covers structures, props, trees, fences and wall segments
        // (left intentionally empty to avoid duplicate resolution)
        
        // Haze damage at edges (use squared distance to avoid unnecessary sqrt)
        const dxC = this.x - WORLD_SIZE/2;
        const dyC = this.y - WORLD_SIZE/2;
        const distSqC = dxC * dxC + dyC * dyC;
        const hazeThreshold = 30;
        if (distSqC > hazeThreshold * hazeThreshold) {
            const distFromCenter = Math.sqrt(distSqC);
            const hazeDmg = (distFromCenter - hazeThreshold) * 2 * dt;
            this.health -= hazeDmg;
            this.burden += hazeDmg * 0.5;
        }
    },
    
    // ================================================================
    // SKILL 1: PREDATORY MOTION — Movement + Attack hybrid
    // "Movement is survival. Standing still is ideology."
    // ================================================================
    predatoryMotion() {
        if (this.cooldowns.predatory > 0 || this.stamina < 18) return;
        const skl = greyline?.knobs?.skl || { size: 1.0, dur: 1.0, noise: 0.0, selfCost: 1.0 };
        const sizeM = skl.size;
        const durM  = skl.dur;
        const noise = skl.noise;
        const selfCostM = skl.selfCost;
        const cdEff = skl.cdEff || 1.0;

        
        const side = greyline.getSide();
        psychStats.recordSkillUse('predatory');
        
        let dx = 0, dy = 0;
        // Isometric-corrected dash direction
        if (input.keys['w']) { dx -= 1; dy -= 1; }
        if (input.keys['s']) { dx += 1; dy += 1; }
        if (input.keys['a']) { dx -= 1; dy += 1; }
        if (input.keys['d']) { dx += 1; dy -= 1; }
        if (dx === 0 && dy === 0) dx = this.facing;
        
        const len = Math.sqrt(dx * dx + dy * dy);
        this.dashDirX = dx / len;
        this.dashDirY = dy / len;
        
        // Duration varies by Greyline state
        if (side === 'restraint') {
            this.dashTimer = 0.12 * durM; // Short cautious hop
        } else if (side === 'compulsion') {
            this.dashTimer = 0.3 * durM;  // Overcommit lunge (risky)
        } else {
            this.dashTimer = 0.2 * durM;  // Fluid dash, clean exit
        }
        
        this.state = 'dashing';
        this.invulnTimer = this.dashTimer + 0.05;
        this.cooldowns.predatory = (1.2 - psychStats.adaptability.value * 0.3) / cdEff;
        this.stamina -= 18 * (greyline.knobs?.eco?.stamDrain ?? 1.0);
        this.inactivityTimer = 0;
        this.skillUsage.predatory += 1;
        
        // SFX — dash swoosh
        if (audioEngine) audioEngine.playDash();
        
        greyline.push(1, 0.012);
        psychStats.recordDodge();
        camera.addShake(3);
        
        // Trail particles — much richer burst
        const trailType = this.shadowActive ? 'shadow_trail' : 'dash_trail';
        for (let i = 0; i < 8; i++) {
            particles.push({
                x: this.x + (Math.random() - 0.5) * 0.3, 
                y: this.y + (Math.random() - 0.5) * 0.3,
                vx: -this.dashDirX * (2 + Math.random() * 2) + (Math.random() - 0.5) * 1.5,
                vy: -this.dashDirY * (2 + Math.random() * 2) + (Math.random() - 0.5) * 1.5,
                type: trailType,
                timer: 0.3 + Math.random() * 0.3,
                size: 2 + Math.random() * 3
            });
        }
        // Ground dust kick at origin
        for (let i = 0; i < 5; i++) {
            const angle = Math.random() * Math.PI * 2;
            particles.push({
                x: this.x, y: this.y,
                vx: Math.cos(angle) * (1.5 + Math.random()),
                vy: Math.sin(angle) * (0.8 + Math.random() * 0.5),
                type: 'dash_dust',
                timer: 0.4 + Math.random() * 0.3,
                size: 3 + Math.random() * 4
            });
        }
        // Speed streak — elongated motion line
        particles.push({
            x: this.x, y: this.y,
            vx: this.dashDirX * 4, vy: this.dashDirY * 4,
            type: 'dash_streak',
            timer: 0.25,
            size: 6,
            angle: Math.atan2(this.dashDirY, this.dashDirX)
        });
    },
    
    // ================================================================
    // SKILL 2: ADAPTIVE SNARE — Trap that adapts, then weakens
    // "Preparation without flexibility becomes dogma."
    // ================================================================
    adaptiveSnare() {
        if (this.cooldowns.snare > 0 || this.stamina < 15) return;
        const skl = greyline?.knobs?.skl || { size: 1.0, dur: 1.0, noise: 0.0, selfCost: 1.0 };
        const sizeM = skl.size;
        const durM  = skl.dur;
        const noise = skl.noise;
        const selfCostM = skl.selfCost;
        const cdEff = skl.cdEff || 1.0;

        
        psychStats.recordSkillUse('snare');
        this.snareUseCount++;
        
        // Diminishing returns — the snare learns once, then weakens
        const effectiveness = Math.max(0.3, 1.0 - this.snareUseCount * 0.12);
        
        const placeJ = noise * 18;
        const px = this.x + Math.sin(gameTime * 7.1 + this.snareUseCount) * placeJ;
        const py = this.y + Math.cos(gameTime * 6.4 + this.snareUseCount) * placeJ;
        this.snarePlaced.push({
            x: px, y: py,
            timer: 8 * effectiveness * durM,
            radius: 1.5 * sizeM,
            triggered: false,
            timesUsed: 0,
            effectiveness: effectiveness,
            pulse: 0
        });
        
        // Cooldown increases with overuse
        this.cooldowns.snare = (2.5 + this.snareUseCount * 0.5) / cdEff;
        this.stamina -= 15 * (greyline.knobs?.eco?.stamDrain ?? 1.0);
        this.inactivityTimer = 0;
        this.skillUsage.snare += 1;
        
        greyline.push(-1, 0.01); // Planning = restraint
        
        // SFX
        if (audioEngine) audioEngine.playSnare();
        
        // Over-preparation penalty — too many active snares push deep restraint
        if (this.snarePlaced.length > 3) {
            greyline.push(-1, 0.02 * this.snarePlaced.length);
            psychStats.adaptability.value -= 0.02;
        }
        
        // Visual: sigil appears with expanding rings
        particles.push({
            x: this.x, y: this.y,
            vx: 0, vy: 0,
            type: 'snare_deploy',
            timer: 0.8,
            size: 18
        });
        // Rune fragments orbiting outward
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            particles.push({
                x: this.x, y: this.y,
                vx: Math.cos(angle) * 2.5,
                vy: Math.sin(angle) * 1.2,
                type: 'snare_rune',
                timer: 0.5 + Math.random() * 0.3,
                size: 2 + Math.random(),
                angle: angle
            });
        }
        // Ground inscription pulse
        particles.push({
            x: this.x, y: this.y,
            vx: 0, vy: 0,
            type: 'snare_inscription',
            timer: 1.2,
            size: 20 * effectiveness
        });
        camera.addShake(1.5);
    },
    
    // ================================================================
    // SKILL 3: RECLAMATION — Nature as inevitability
    // "You don't dominate nature. You work with time."
    // ================================================================
    reclamation() {
        if (this.cooldowns.reclaim > 0 || this.stamina < 20) return;
        const skl = greyline?.knobs?.skl || { size: 1.0, dur: 1.0, noise: 0.0, selfCost: 1.0 };
        const sizeM = skl.size;
        const durM  = skl.dur;
        const noise = skl.noise;
        const selfCostM = skl.selfCost;
        const cdEff = skl.cdEff || 1.0;

        
        psychStats.recordSkillUse('reclaim');
        
        const side = greyline.getSide();
        let maxRadius, duration;
        
        if (side === 'restraint') {
            // Slow, safe spread
            maxRadius = 3.5 * sizeM;
            duration = 12;
        } else if (side === 'compulsion') {
            // Violent but unstable growth
            maxRadius = 5;
            duration = 6; // Burns out faster
        } else {
            // Persistent, controllable
            maxRadius = 4 * sizeM;
            duration = 10 * durM;
        }
        
        this.reclaimZones.push({
            x: this.x, y: this.y,
            timer: duration,
            age: 0,
            radius: 0.5,
            maxRadius: maxRadius,
            pulse: 0,
            unstable: side === 'compulsion'
        });
        
        this.cooldowns.reclaim = (8) / cdEff;
        this.stamina -= 20 * (greyline.knobs?.eco?.stamDrain ?? 1.0);
        this.inactivityTimer = 0;
        this.skillUsage.reclaim += 1;
        
        // Neither extreme push — Reclamation is patient
        // But it slightly centers the greyline (working with time)
        const centerPull = greyline.value > 0.5 ? -1 : 1;
        greyline.push(centerPull, 0.005);
        
        // SFX
        if (audioEngine) audioEngine.playReclaim();
        
        // Ground crack visual — radiating fissures
        for (let i = 0; i < 10; i++) {
            const angle = (i / 10) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
            particles.push({
                x: this.x, y: this.y,
                vx: Math.cos(angle) * (1.5 + Math.random()),
                vy: Math.sin(angle) * (0.8 + Math.random() * 0.4),
                type: 'reclaim_crack',
                timer: 1.2 + Math.random() * 0.8,
                size: 1 + Math.random() * 2.5,
                angle: angle
            });
        }
        // Rising spores — organic growth erupting
        for (let i = 0; i < 8; i++) {
            particles.push({
                x: this.x + (Math.random() - 0.5) * 1.5,
                y: this.y + (Math.random() - 0.5) * 1.5,
                vx: (Math.random() - 0.5) * 1.2,
                vy: -(0.5 + Math.random() * 1.5),
                type: 'reclaim_spore',
                timer: 1.5 + Math.random() * 1.0,
                size: 1.5 + Math.random() * 2
            });
        }
        // Earth pulse ring — ground tremor wave
        particles.push({
            x: this.x, y: this.y,
            vx: 0, vy: 0,
            type: 'reclaim_pulse',
            timer: 1.0,
            size: 8
        });
        // Root tendrils — creeping lines from center
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + Math.random() * 0.5;
            particles.push({
                x: this.x, y: this.y,
                vx: Math.cos(angle) * 0.8,
                vy: Math.sin(angle) * 0.4,
                type: 'reclaim_tendril',
                timer: 2.0 + Math.random(),
                size: 2,
                angle: angle
            });
        }
        
        camera.addShake(3);
    },
    
    // ================================================================
    // SKILL 4: ATTUNEMENT — Perception & Presence
    // "Presence is active. Reflection is not escape."
    // ================================================================
    attune() {
        if (this.cooldowns.attune > 0) return;
        const skl = greyline?.knobs?.skl || { size: 1.0, dur: 1.0, noise: 0.0, selfCost: 1.0 };
        const sizeM = skl.size;
        const durM  = skl.dur;
        const noise = skl.noise;
        const selfCostM = skl.selfCost;
        const cdEff = skl.cdEff || 1.0;

        
        psychStats.recordSkillUse('attune');
        this.attuneUseCount++;
        this.attuneWindowTimer = 15; // Track uses within 15s window
        
        this.state = 'attune';
        // Duration shortened by overuse — paralysis
        const baseDuration = 1.5;
        const overusePenalty = Math.min(0.8, this.attuneUseCount * 0.2);
        this.attuneTimer = (baseDuration - overusePenalty) * durM;
        this.cooldowns.attune = (4 + this.attuneUseCount * 0.5) / cdEff;
        this.inactivityTimer = 0;
        this.skillUsage.attune += 1;
        
        // Attunement pushes toward restraint (stillness)
        greyline.push(-1, 0.015);
        
        // SFX
        if (audioEngine) audioEngine.playAttune();
        
        // But overuse is restraint-as-escape — the game notices
        if (this.attuneUseCount > 3) {
            greyline.push(-1, 0.03); // Deeper into restraint
        }
        
        // Visual: stillness ring — expanding clarity wave
        particles.push({
            x: this.x, y: this.y,
            vx: 0, vy: 0,
            type: 'attune_pulse',
            timer: this.attuneTimer + 0.5,
            size: 30
        });
        // Awareness motes — floating perception sparks
        for (let i = 0; i < 10; i++) {
            const angle = (i / 10) * Math.PI * 2;
            const dist = 1 + Math.random() * 2;
            particles.push({
                x: this.x + Math.cos(angle) * dist,
                y: this.y + Math.sin(angle) * dist,
                vx: Math.cos(angle) * 0.2,
                vy: -0.3 - Math.random() * 0.5,
                type: 'attune_mote',
                timer: this.attuneTimer + Math.random() * 0.5,
                size: 1 + Math.random() * 1.5,
                angle: angle,
                orbitR: dist
            });
        }
        // Ground glyph — intricate circle beneath player
        particles.push({
            x: this.x, y: this.y,
            vx: 0, vy: 0,
            type: 'attune_glyph',
            timer: this.attuneTimer + 0.3,
            size: 22
        });
        // Inner light bloom
        particles.push({
            x: this.x, y: this.y,
            vx: 0, vy: 0,
            type: 'attune_bloom',
            timer: 0.6,
            size: 35
        });
    },
    
    // ================================================================
    // SKILL 5: BURDEN SHIFT — Cost management
    // "Pain doesn't vanish. It moves."
    // ================================================================
    burdenShift() {
        if (this.cooldowns.burdenShift > 0 || this.burden < 15) return;
        const skl = greyline?.knobs?.skl || { size: 1.0, dur: 1.0, noise: 0.0, selfCost: 1.0 };
        const sizeM = skl.size;
        const durM  = skl.dur;
        const noise = skl.noise;
        const selfCostM = skl.selfCost;
        const cdEff = skl.cdEff || 1.0;

        
        psychStats.recordSkillUse('burdenShift');
        
        const side = greyline.getSide();
        const burdenStat = psychStats.burden.value;
        
        // What happens depends on greyline state
        if (side === 'compulsion') {
            // Overload cascade — burden converts to self-damage + area blast
            const amount = this.burden * 0.6;
            this.burden -= amount;
            this.health -= amount * 0.15; // Backlash
            
            // Massive area damage
            for (const enemy of adaptiveArray(enemies)) {
                if (enemy.dead) continue;
                const dx = enemy.x - this.x;
                const dy = enemy.y - this.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < 16) { // 4^2
                    enemy.takeDamage(amount * 0.9, this.x, this.y);
                    enemy.stunTimer = 0.5;
                }
            }
            camera.addShake(8);
            greyline.push(1, 0.03); // Violent act
            
        } else if (side === 'restraint') {
            // Unused capacity — converts burden to stamina, less effective
            const amount = this.burden * 0.3;
            this.burden -= amount;
            this.stamina = Math.min(this.maxStamina, this.stamina + amount * 1.5);
            // No damage dealt — restraint refuses to redirect suffering outward
            camera.addShake(2);
            
        } else {
            // Controlled suffering — balanced redistribution
            const amount = this.burden * 0.5;
            this.burden -= amount;
            
            // Part becomes healing
            this.health = Math.min(this.maxHealth, this.health + amount * 0.2);
            
            // Part damages nearby enemies
            for (const enemy of adaptiveArray(enemies)) {
                if (enemy.dead) continue;
                const dx = enemy.x - this.x;
                const dy = enemy.y - this.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < 9) { // 3^2
                    enemy.takeDamage(amount * 0.6, this.x, this.y);
                    enemy.stunTimer = 0.8;
                }
            }
            camera.addShake(5);
        }
        
        this.cooldowns.burdenShift = (7 - burdenStat * 2) / cdEff; // High burden stat = faster reuse
        this.skillUsage.burdenShift += 1;
        
        // SFX
        if (audioEngine) audioEngine.playBurdenShift();
        
        // Burden shift particles — dramatically different per greyline state
        const burstColor = side === 'compulsion' ? '#6a3020' : 
                          side === 'restraint' ? '#3a4a50' : '#5a4a3a';
        // Primary wave ring
        for (let i = 0; i < 14; i++) {
            const angle = (i / 14) * Math.PI * 2;
            const speed = side === 'compulsion' ? 5 : side === 'restraint' ? 2 : 3.5;
            particles.push({
                x: this.x, y: this.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed * 0.6,
                type: 'burden_wave',
                timer: 0.6 + Math.random() * 0.4,
                size: 3 + Math.random() * 3,
                color: burstColor
            });
        }
        // Shockwave ring — expanding ground tremor
        particles.push({
            x: this.x, y: this.y,
            vx: 0, vy: 0,
            type: 'burden_shockwave',
            timer: 0.8,
            size: 10,
            color: burstColor
        });
        // Compulsion: violent eruption shards
        if (side === 'compulsion') {
            for (let i = 0; i < 8; i++) {
                const angle = Math.random() * Math.PI * 2;
                particles.push({
                    x: this.x, y: this.y,
                    vx: Math.cos(angle) * (3 + Math.random() * 4),
                    vy: Math.sin(angle) * 2 - Math.random() * 3,
                    type: 'burden_shard',
                    timer: 0.8 + Math.random() * 0.5,
                    size: 2 + Math.random() * 3,
                    angle: angle
                });
            }
        }
        // Restraint: inward-swirling motes (energy absorbed)
        if (side === 'restraint') {
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                const dist = 2 + Math.random();
                particles.push({
                    x: this.x + Math.cos(angle) * dist,
                    y: this.y + Math.sin(angle) * dist,
                    vx: -Math.cos(angle) * 2,
                    vy: -Math.sin(angle) * 1.2,
                    type: 'burden_absorb',
                    timer: 0.6 + Math.random() * 0.3,
                    size: 2 + Math.random() * 2
                });
            }
        }
        // Rising cost vapor — the pain doesn't vanish
        for (let i = 0; i < 5; i++) {
            particles.push({
                x: this.x + (Math.random() - 0.5) * 1.5,
                y: this.y + (Math.random() - 0.5) * 0.5,
                vx: (Math.random() - 0.5) * 0.5,
                vy: -(0.8 + Math.random() * 1.2),
                type: 'burden_vapor',
                timer: 1.0 + Math.random() * 0.5,
                size: 4 + Math.random() * 3,
                color: burstColor
            });
        }
    },
    
    // ================================================================
    // SKILL 6: SHADOW ACKNOWLEDGEMENT — The most dangerous skill
    // "Integration is not indulgence."
    // ================================================================
    shadowAcknowledge() {
        if (this.cooldowns.shadow > 0 || this.shadowActive) return;
        const skl = greyline?.knobs?.skl || { size: 1.0, dur: 1.0, noise: 0.0, selfCost: 1.0 };
        const sizeM = skl.size;
        const durM  = skl.dur;
        const noise = skl.noise;
        const selfCostM = skl.selfCost;
        const cdEff = skl.cdEff || 1.0;

        
        psychStats.recordSkillUse('shadow');
        
        const side = greyline.getSide();
        
        if (side === 'restraint' && greyline.getExtremity() > 0.3) {
            // Fizzles at deep restraint — you're too defended
            this.cooldowns.shadow = (5) / cdEff;
            // Brief spark that dies — the shadow tried but you wouldn't let it
            particles.push({
                x: this.x, y: this.y,
                vx: 0, vy: -0.5,
                type: 'shadow_fizzle',
                timer: 0.6,
                size: 10
            });
            camera.addShake(1);
            return;
        }
        
        this.shadowActive = true;
        this.shadowDenialTimer = 0;
        
        // Duration depends on balance
        if (greyline.isBalanced()) {
            this.shadowTimer = 5; // Terrifying, precise, longer
        } else if (side === 'compulsion') {
            this.shadowTimer = 3; // Shorter, risk of possession
        } else {
            this.shadowTimer = 2; // Reluctant emergence
        }
        
        this.cooldowns.shadow = 18;
        this.skillUsage.shadow += 1;
        
        // SFX
        if (audioEngine) audioEngine.playShadow();
        
        greyline.push(1, 0.04);
        
        // Dramatic visual — shadow erupts violently
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            particles.push({
                x: this.x, y: this.y,
                vx: Math.cos(angle) * (2.5 + Math.random()),
                vy: Math.sin(angle) * 2 - 1.5,
                type: 'shadow_emerge',
                timer: 0.8 + Math.random() * 0.6,
                size: 4 + Math.random() * 4
            });
        }
        // Dark tendrils — creeping shadow arms
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.5;
            particles.push({
                x: this.x, y: this.y,
                vx: Math.cos(angle) * 1.5,
                vy: Math.sin(angle) * 0.8,
                type: 'shadow_tendril',
                timer: 1.5 + Math.random() * 0.5,
                size: 3 + Math.random() * 2,
                angle: angle
            });
        }
        // Ground corruption — dark stain spreading
        particles.push({
            x: this.x, y: this.y,
            vx: 0, vy: 0,
            type: 'shadow_corruption',
            timer: this.shadowTimer,
            size: 30
        });
        // Purple energy vortex — swirling inward
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const dist = 2 + Math.random();
            particles.push({
                x: this.x + Math.cos(angle) * dist,
                y: this.y + Math.sin(angle) * dist,
                vx: -Math.sin(angle) * 2,
                vy: Math.cos(angle) * 1.2 - 0.5,
                type: 'shadow_vortex',
                timer: 1.2 + Math.random() * 0.5,
                size: 2 + Math.random() * 2
            });
        }
        // Initial flash — dark energy burst
        particles.push({
            x: this.x, y: this.y,
            vx: 0, vy: 0,
            type: 'shadow_flash',
            timer: 0.5,
            size: 40
        });
        camera.addShake(6);
    },
    
    // ================================================================
    // BASIC ATTACK — Left click
    // ================================================================
    attack() {
        if (this.attackCooldown > 0 || this.state === 'dashing' || this.state === 'attune') return;
        if (this.stamina < 8) return;
        
        const precisionMod = psychStats.precision.value;
        const agencyMod = psychStats.agency.value;
        
        // Calculate attack direction toward mouse in world space
        const cam = camera.getOffset();
        // Account for camera zoom when converting mouse screen position to world
        const mouseWorldPos = screenToWorld(input.mouse.x / camera.zoom - cam.x, input.mouse.y / camera.zoom - cam.y);
        const adx = mouseWorldPos.x - this.x;
        const ady = mouseWorldPos.y - this.y;
        this.attackAngle = Math.atan2(ady, adx);
        // Convert attack direction to screen space for correct sprite selection
        const atkScreenDir = worldToScreen(adx, ady);
        this.facingDir = angleToDir8(Math.atan2(atkScreenDir.y, -atkScreenDir.x));
        this.facing = adx >= 0 ? 1 : -1;
        
        this.state = 'attacking';
        this.attackTimer = 0.25 / (precisionMod * 0.7 + 0.3);
        // Stronger left-click cooldown to reduce spammability
        this.attackCooldown = 0.22;
        this.stamina -= 8 * (greyline.knobs?.eco?.stamDrain ?? 1.0);
        this.comboCount++;
        this.comboTimer = 1.0;
        this.inactivityTimer = 0;
        this.lastActionTime = performance.now();
        this.actionCount++;
        
        // SFX — attack swoosh
        if (audioEngine) audioEngine.playAttack();
        
        psychStats.recordAttack();
        
        // Action pushes toward compulsion
        greyline.push(1, 0.008);
        
        // Rapid attacks push harder — the game notices spamming
        if (this.comboCount > 3) {
            greyline.push(1, 0.015 * this.comboCount);
            // Precision degrades with spam
            psychStats.precision.value -= 0.005 * (this.comboCount - 3);
        }
        
        // ── DAMAGE CALCULATION ──
        let baseDmg = 12 + this.comboCount * 2;
        
        // Equipment damage multiplier
        baseDmg *= equipBonuses.damage;
        
        // Equipment attack speed modifier (affects cooldown)
        this.attackCooldown *= (1 / Math.max(0.3, equipBonuses.speed));
        // Prevent equipment from reducing cooldown below a conservative floor
        // Enforce a conservative 0.7s minimum left‑click melee cooldown (tunable)
        this.attackCooldown = Math.max(0.7, this.attackCooldown);
        
        // Shadow doubles damage
        if (this.shadowActive) baseDmg *= 2.0;
        
        // Precision affects crit chance
        const critChance = precisionMod * 0.25 * (greyline.isBalanced() ? 1.5 : 0.7);
        const isCrit = Math.random() < critChance;
        if (isCrit) baseDmg *= 1.6;
        
        // At restraint extreme: brittle precision shatters on use
        if (greyline.getSide() === 'restraint' && greyline.getExtremity() > 0.4) {
            psychStats.precision.value -= 0.03; // Precision shatters
        }
        
        const range = 1.8 * equipBonuses.range;
        let hitSomething = false;
        
        for (const enemy of adaptiveArray(enemies)) {
            if (enemy.dead) continue;
            const dx = enemy.x - this.x;
            const dy = enemy.y - this.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < range * range) {
                // Cone-based hit check using attack angle (90° arc)
                const angleToEnemy = Math.atan2(dy, dx);
                let angleDiff = Math.abs(angleToEnemy - this.attackAngle);
                if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
                if (angleDiff < Math.PI * 0.55 || dist < 1.0) {
                    enemy.takeDamage(baseDmg, this.x, this.y);
                    hitSomething = true;
                    camera.addShake(isCrit ? 5 : 3);
                    
                    // SFX — impact thud
                    if (audioEngine) audioEngine.playHit();
                    
                    // Lifesteal from equipment
                    if (equipBonuses.lifesteal > 0) {
                        const heal = baseDmg * equipBonuses.lifesteal;
                        this.health = Math.min(this.maxHealth, this.health + heal);
                    }
                    
                    // Stun chance from equipment
                    if (equipBonuses.stun > 0 && Math.random() < equipBonuses.stun) {
                        if (enemy.stunTimer !== undefined) {
                            enemy.stunTimer = Math.max(enemy.stunTimer || 0, 0.8);
                        }
                    }
                    
                    if (isCrit) {
                        // Crit flash particle
                        particles.push({
                            x: enemy.x, y: enemy.y,
                            vx: 0, vy: 0,
                            type: 'crit_flash',
                            timer: 0.25,
                            size: 8
                        });
                    }
                }
            }
        }
        
        // Hitting different enemies builds adaptability
        if (hitSomething) {
            psychStats.adaptability.value = Math.min(1, psychStats.adaptability.value + 0.01);
        }
        
        // legacy instant-reset removed — cooldown is enforced server-side (1.0s min)
    },
    
    // ================================================================
    // TAKE DAMAGE
    // ================================================================
    // ================================================================
    // GUN — Right click (ranged). Simple, honest tool; the Greyline is what bends it.
    // ================================================================
    shootGun() {
        if (this.state === 'dashing' || this.state === 'attune') return;
        if (this.reloading) return;
        if (this.gunCooldown > 0) return;
        // Soft gate: gun respects stamina, but doesn't hard-lock you out
        const stamCost = 4 * (greyline.knobs?.eco?.stamDrain ?? 1.0);
        if (this.stamina < stamCost) return;

        if (this.ammo <= 0) {
            this.startReload();
            return;
        }

        // Aim direction uses the same mouse→world conversion as melee
        const cam = camera.getOffset();
        const mouseWorldPos = screenToWorld(input.mouse.x / camera.zoom - cam.x, input.mouse.y / camera.zoom - cam.y);
        let dx = mouseWorldPos.x - this.x;
        let dy = mouseWorldPos.y - this.y;
        const d = Math.hypot(dx, dy) || 1;
        dx /= d; dy /= d;

        // Facing
        const atkScreenDir = worldToScreen(dx, dy);
        this.facingDir = angleToDir8(Math.atan2(atkScreenDir.y, -atkScreenDir.x));
        this.facing = dx >= 0 ? 1 : -1;

        // Greyline modulation (spread + cadence)
        const g = greyline.g ?? 0;
        const a = Math.min(1, Math.abs(g));
        const wL = Math.max(0, -g);
        const wR = Math.max(0, +g);
        const v = greyline.v ?? 0;

        const baseSpread = 0.070; // radians (tighter than shotgun, looser than laser)
        const spread = baseSpread * (1.0 - wL * 0.25 + wR * 0.55 + v * 0.35);
        const ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * spread;

        const speed = 13;
        const dmgBase = 6.0 * equipBonuses.damage;
        const critChance = (psychStats.precision.value * 0.18) * (greyline.isBalanced() ? 1.25 : 0.8);
        const isCrit = Math.random() < critChance;
        const dmg = dmgBase * (isCrit ? 1.55 : 1.0);

        particles.push({
            x: this.x + Math.cos(ang) * 0.9,
            y: this.y + Math.sin(ang) * 0.9,
            vx: Math.cos(ang) * speed,
            vy: Math.sin(ang) * speed,
            type: 'player_bullet',
            timer: 1.0,
            size: isCrit ? 3.2 : 2.6,
            damage: dmg,
            pierce: 0, // never pierce; keep the gun honest
            crit: isCrit
        });

        this.stamina -= stamCost;
        this.ammo -= 1;

        // Cadence: restraint slows, compulsion tempts speed but costs later (handled in stamina/instability systems)
        const cadenceMult = (greyline.knobs?.gun?.cadence ?? (1.0 - wL * 0.20 + wR * 0.10));
        // Raise minimum gun cooldown slightly to curb extreme rapid-fire
        this.gunCooldown = Math.max(0.20, this.gunFireRate / Math.max(0.55, cadenceMult));

        this.inactivityTimer = 0;
        this.lastActionTime = performance.now();
        this.actionCount++;

        // SFX — make sure audio engine has been created & unlocked
        if (!audioEngine) {
            try { initTitleMusic(); } catch(e) { console.warn('[Audio] initTitleMusic failed during shoot', e); }
        }
        ensureAudioUnlocked();
        if (audioEngine) audioEngine.playGunShot(wR, a);
        // Show the gun-attack test sprite briefly (if present)
        this._gunSpriteTimer = 0.18;

        // Drift hook: sustained shooting nudges restraint (avoid pure kiting loops)
        greyline.push(+1, 0.0035 + wR * 0.0025);
    },

    startReload() {
        if (this.reloading) return;
        if (this.ammo >= this.maxAmmo) return;
        this.reloading = true;
        // Reload length becomes cognitively "heavier" in restraint (over-control) and "sloppier" in compulsion (fumbled)
        const g = greyline.g ?? 0;
        const wL = Math.max(0, -g);
        const wR = Math.max(0, +g);
        this.reloadTimer = 1.25 + wL * 0.45 + wR * 0.25;
        if (audioEngine) audioEngine.playReload();
    },

    takeDamage(amount) {
        if (this.invulnTimer > 0) return;
        
        const integrityMod = psychStats.integrity.value;
        const side = greyline.getSide();
        
        let dmgMult = 1.0;
        if (side === 'restraint') {
            // Brittle integrity — seems fine then shatters
            if (greyline.getExtremity() > 0.4) {
                dmgMult = 1.0 + (1 - integrityMod) * 1.5; // Shatters suddenly
                psychStats.integrity.value -= 0.05; // Each hit weakens further
            }
        } else if (side === 'compulsion') {
            // Gradual erosion
            dmgMult = 1.0 + (1 - integrityMod) * 0.5;
        }
        
        // Equipment defense reduces damage
        const defenseMod = Math.max(0, 1 - equipBonuses.defense);
        const dmg = amount * dmgMult * defenseMod;
        this.health -= dmg;
        // Burden resist from equipment
        this.burden += dmg * 0.25 * Math.max(0, 1 - equipBonuses.burdenResist);
        this.invulnTimer = 0.3;
        
        camera.addShake(5);
        
        // SFX — player hit
        if (audioEngine) audioEngine.playPlayerHit();
        
        // Flash — subtle, not dramatic
        const flash = document.getElementById('damage-flash');
        if (flash) {
            flash.style.background = `rgba(100,30,20,${Math.min(0.35, dmg * 0.015)})`;
            setTimeout(() => flash.style.background = 'rgba(100,30,20,0)', 120);
        }
        
        // Damage pushes toward restraint (flinching, protecting)
        greyline.push(-1, 0.015);
        
        // Being hit builds burden stat (hardship grows capacity)
        psychStats.burden.value = Math.min(1, psychStats.burden.value + 0.02);
    }
};

// ============================================================
// ENEMIES
// ============================================================
let enemies = [];
let particles = [];

class Enemy {
    constructor(type, x, y) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.health = 0;
        this.maxHealth = 0;
        this.damage = 0;
        this.speed = 0;
        this.attackRange = 1.2;
        this.attackCooldown = 0;
        this.attackRate = 2.0;
        this.dead = false;
        this.deathTimer = 0;
        this.stunTimer = 0;
        this.aggroRange = 8;
        this.state = 'idle';
        this.stateTimer = 0;
        this.facing = 1;
        this.facingDir = 2;     // 8-direction: 0=N,1=NE,2=E,3=SE,4=S,5=SW,6=W,7=NW
        this.moveAngle = 0;     // raw movement angle
        this.bobPhase = Math.random() * Math.PI * 2;
        this.knockbackX = 0;
        this.knockbackY = 0;
        this.patternPhase = 0;
        this.snaredSlowTimer = 0;
        
        // Drifting-specific
        this.orbitAngle = Math.random() * Math.PI * 2;
        this.orbitDir = Math.random() > 0.5 ? 1 : -1;
        this.dashTarget = null;
        this.disengageTimer = 0;
        this.harassCount = 0;
        this.lastHarassTime = 0;
        
        // Watchful-specific
        this.vigilanceStacks = 0;
        this.scanAngle = 0;
        this.burstCount = 0;
        this.burstCooldown = 0;
        this.overcommitTimer = 0;
        this.lastSeenPlayerX = 0;
        this.lastSeenPlayerY = 0;
        this.hasLineOfSight = false;
        this.warningTimer = 0;
        
        this.configure();
    }
    
    configure() {
        switch (this.type) {
            case 'lingering':
                this.health = this.maxHealth = 40;
                this.damage = 8;
                this.speed = 0.8;
                this.attackRate = 3.0; // hesitant
                this.aggroRange = 6;
                break;
            case 'watchful':
                this.health = this.maxHealth = 55;
                this.damage = 10;
                this.speed = 0;          // does not move — rooted duty
                this.attackRange = 9;    // long sightline
                this.attackRate = 1.8;   // base rate, modified by vigilance
                this.aggroRange = 12;    // sees far
                this.vigilanceStacks = 0;
                this.scanAngle = Math.random() * Math.PI * 2;
                this.state = 'watching';
                break;
            case 'huddled':
                this.health = this.maxHealth = 25;
                this.damage = 5;
                this.speed = 1.0;
                this.attackRate = 1.5;
                this.aggroRange = 5;
                break;
            case 'rehearsed':
                this.health = this.maxHealth = 50;
                this.damage = 14;
                this.speed = 1.5;
                this.attackRate = 1.2; // fixed pattern, fast
                this.aggroRange = 7;
                break;
            case 'burdened':
                this.health = this.maxHealth = 120;
                this.damage = 25;
                this.speed = 0.4;
                this.attackRate = 4.0;
                this.attackRange = 1.8;
                this.aggroRange = 5;
                break;
            case 'drifting':
                this.health = this.maxHealth = 30;
                this.damage = 8;
                this.speed = 2.2;        // fast — surrender mistaken for peace
                this.attackRate = 1.2;   // quick harass cooldown
                this.attackRange = 1.5;  // melee lunge range
                this.aggroRange = 14;    // wide awareness, drifts toward everything
                this.orbitAngle = Math.random() * Math.PI * 2;
                this.orbitDir = Math.random() > 0.5 ? 1 : -1;
                this.state = 'drifting';
                break;
            case 'deferred':
                this.health = this.maxHealth = 20;
                this.damage = 10;
                this.speed = 0;
                this.attackRate = 0.5;
                this.aggroRange = 2;
                break;
            case 'remembered':
                this.health = this.maxHealth = 60;
                this.damage = 10;
                this.speed = 1.2;
                this.attackRate = 2.0;
                this.aggroRange = 8;
                break;
            case 'hollow_warden':
                this.health = this.maxHealth = 500;
                this.damage = 20;
                this.speed = 0.6;
                this.attackRate = 2.5;
                this.attackRange = 3.5;
                this.aggroRange = 18;
                this.isBoss = true;
                this.bossPhase = 0; // 0=normal, 1=enraged (<50%), 2=desperate (<20%)
                this.bossAttackPattern = 0; // cycles through 3 attacks
                this.bossSlamTimer = 0;
                this.bossSweepAngle = 0;
                this.bossChargeTarget = null;
                this.bossChargeTimer = 0;
                this.bossVoidTimer = 0;
                this.bossVoidZones = [];
                break;
        }
    }
    
    

// Greyline-aware AI modulation — preserves enemy identity, modulates expression.
getAI() {
    return this._ai || (greyline.knobs && greyline.knobs.ai) || {};
}
getAggroRange() {
    const ai = this.getAI();
    // ensure a minimum detection multiplier so enemies still engage at balance
    const m = Math.max(0.6, (ai.aggro ?? 1.0));
    return this.aggroRange * m;
}
getAttackCDMod() {
    const ai = this.getAI();
    const delay = (ai.delay ?? 0.0);      // restraint: longer tells
    const swarm = (ai.swarm ?? 0.0);      // compulsion: tighter pressure
    // Delay stretches cadence; swarm slightly compresses cadence.
    return (1.0 + delay * 0.35) * (1.0 - Math.min(0.30, swarm * 0.12));
}
setAttackCooldown(baseSeconds) {
    this.attackCooldown = Math.max(0.05, baseSeconds * this.getAttackCDMod());
}
shouldFeint() {
    const ai = this.getAI();
    const p = (ai.feint ?? 0.0) * 0.18;
    return Math.random() < p;
}
isPlayerStatic() {
    // using squared speed to avoid costly sqrt; threshold 0.15^2 = 0.0225
    return (this._playerSpeedSq ?? 0) < 0.15 * 0.15;
}
isPlayerOverextending() {
    return player.state === 'dashing' || player.state === 'attacking';
}

getAttackRange() {
    const ai = this.getAI();
    let r = this.attackRange;
    // Restraint: punishes immobility (player "thinking" too long) via reach/commit pressure.
    if (this.isPlayerStatic()) r *= (1.0 + (ai.punishStatic ?? 0) * 0.25);
    // Compulsion: punishes overextension (dash/attack spam) via counter-reach.
    if (this.isPlayerOverextending()) r *= (1.0 + (ai.punishOver ?? 0) * 0.20);
    return r;
}
getMovePace() {
    const ai = this.getAI();
    let p = 1.0 + (ai.swarm ?? 0) * 0.20 - (ai.delay ?? 0) * 0.10;
    if (this.isPlayerStatic()) p += (ai.punishStatic ?? 0) * 0.20;
    if (this.isPlayerOverextending()) p += (ai.punishOver ?? 0) * 0.15;
    return Math.max(0.6, p);
}


update(dt) {
        if (this.dead) {
            this.deathTimer += dt;
            return;
        }
        
        this.bobPhase += dt * 2;
        this.stateTimer += dt;
        this.attackCooldown = Math.max(0, this.attackCooldown - dt);
        this.stunTimer = Math.max(0, this.stunTimer - dt);
        this.snaredSlowTimer = Math.max(0, this.snaredSlowTimer - dt);
        
        if (this.stunTimer > 0) return;


// Greyline AI knobs snapshot for this frame
this._ai = (greyline.knobs && greyline.knobs.ai) ? greyline.knobs.ai : {};
// store squared player velocity magnitude to avoid repeated sqrt calls in each enemy update
this._playerSpeedSq = player.vx * player.vx + player.vy * player.vy;
        
        // Knockback
        this.x += this.knockbackX * dt;
        this.y += this.knockbackY * dt;
        this.knockbackX *= 0.9;
        this.knockbackY *= 0.9;

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq); // use squared distance for comparisons, but still need actual distance later

        // Under heavy restraint, force enemies to chase the player relentlessly
        try {
            if (greyline.getSide() === 'restraint' && greyline.getExtremity() > 0.7) {
                this.state = 'approaching';
                // also bump speed so they actually close
                speedMod *= 1.5;
            }
        } catch(e) {}

        // create snapshot of player mindstate for AI
        let snap = { value: 0.5, trend: 0, awareness: psychStats.awareness.value, agency: psychStats.agency.value };
        try {
            snap.value = greyline.value;
            snap.trend = greyline.value - (this._lastGreyline||greyline.value);
            this._lastGreyline = greyline.value;
            // speed boost spike based on snapshot when chasing and side is compulsion/restraint
            try {
                const side = greyline.getSide();
                if ((side === 'restraint' || side === 'compulsion') && this.state === 'chasing') {
                    const spike = 1 - snap.value * 0.7 - 0.3; // formula from design
                    if (spike > 0) {
                        let boost = 1 + spike * 0.4;
                        if (side === 'compulsion') boost += 0.2; // extra burst on right-side
                        speedMod *= boost;
                    }
                }
            } catch(e) {}
            // apply snapshot modifications to AI knobs
            if (snap.value < 0.3) {
                this._ai.delay = Math.max(this._ai.delay||0, 0.3);
                this._ai.punishStatic = Math.max(this._ai.punishStatic||0, 0.3);
                this._ai.aggro = (this._ai.aggro||1) * 0.9;
            } else if (snap.value > 0.7) {
                this._ai.feint = Math.max(this._ai.feint||0, 0.4);
                this._ai.swarm = Math.max(this._ai.swarm||0, 0.6);
                this._ai.punishOver = Math.max(this._ai.punishOver||0, 0.5);
            } else {
                this._ai.readable = Math.min(1.0, (this._ai.readable||0) + 0.2);
            }
            // boss phase harmony
            if (this.type === 'hollow_warden') {
                if (snap.value < 0.3) this.bossPhase = 0;
                else if (snap.value > 0.7) this.bossPhase = 1;
                else this.bossPhase = 2;
            }
        } catch(e) {}

        // Emergency proximity override: if enemy is effectively on top of player, ensure it can damage.
        if (dist < 0.9 && this.attackCooldown <= 0 && !this.dead) {
            try {
                player.takeDamage(this.damage);
            } catch (e) {}
            this.setAttackCooldown(this.attackRate * 0.6);
            // Short-circuit heavy AI for immediate contact
            return;
        }

        // LOS occlusion timer (blocked LOS behind large props/trees nudges enemy disengage)
        this._losBlockedTimer = this._losBlockedTimer || 0;
        const losBlocked = isOccludedBetween(this.x, this.y, player.x, player.y);
        if (losBlocked && dist < Math.max(6, this.getAggroRange())) {
            this._losBlockedTimer = Math.min(5, this._losBlockedTimer + dt);
        } else {
            this._losBlockedTimer = Math.max(0, this._losBlockedTimer - dt * 1.5);
        }
        if (this._losBlockedTimer > 2.0) {
            // begin subtle disengage
            if (this.state !== 'retreating' && this.state !== 'disengaging') {
                this.state = 'hesitating';
                this.stateTimer = 0;
                particles.push({ x: this.x, y: this.y, vx: 0, vy: -0.4, type: 'disengage_wisp', timer: 0.9, size: 2 });
            }
            greyline.push(-1, 0.003 * dt);
            if (this.harassCount > 0) this.harassCount = Math.max(0, this.harassCount - dt * 0.4);
        }
        
        if (dx !== 0 || dy !== 0) {
            this.facing = dx > 0 ? 1 : -1;
            this.moveAngle = Math.atan2(dy, dx);
            this.facingDir = angleToDir8(this.moveAngle);
        }
        
        // Check snares
        for (const snare of player.snarePlaced) {
            if (snare.triggered) continue;
            const sdx = this.x - snare.x;
            const sdy = this.y - snare.y;
            const sDistSq = sdx * sdx + sdy * sdy;
            if (sDistSq < snare.radius * snare.radius) {
                snare.triggered = true;
                snare.timesUsed++;
                this.stunTimer = Math.max(0.5, 2 - snare.timesUsed * 0.5); // learns, weakens
                this.snaredSlowTimer = 3;
                // Snare punishes static planning — less effective each time
            }
        }
        
        // Type-specific AI
        const speedMod = this.snaredSlowTimer > 0 ? 0.3 : 1.0;
        
        switch (this.type) {
            case 'lingering':
                this.aiLingering(dt, dx, dy, dist, speedMod);
                break;
            case 'watchful':
                this.aiWatchful(dt, dx, dy, dist);
                break;
            case 'huddled':
                this.aiHuddled(dt, dx, dy, dist, speedMod);
                break;
            case 'rehearsed':
                this.aiRehearsed(dt, dx, dy, dist, speedMod);
                break;
            case 'burdened':
                this.aiBurdened(dt, dx, dy, dist, speedMod);
                break;
            case 'drifting':
                this.aiDrifting(dt, dx, dy, dist, speedMod);
                break;
            case 'deferred':
                this.aiDeferred(dt, dx, dy, dist);
                break;
            case 'remembered':
                this.aiRemembered(dt, dx, dy, dist, speedMod);
                break;
        }
        
        // Clamp
        this.x = Math.max(2, Math.min(WORLD_SIZE - 2, this.x));
        this.y = Math.max(2, Math.min(WORLD_SIZE - 2, this.y));
    }
    
    aiLingering(dt, dx, dy, dist, speedMod) {
        // AVOIDANCE AS IDENTITY.
        // The Lingering doesn't want to fight. It approaches, then retreats at the last moment.
        // Each retreat makes the next approach slower. Each forced engagement makes it more dangerous.
        // The longer you leave it alive, the more reluctant it becomes — but its stored frustration
        // detonates if you finally corner it.
        // Psychological message: avoidance compounds. Ignored problems don't disappear.
        
        // Track internal state
        this.retreatCount = this.retreatCount || 0;
        this.frustration = this.frustration || 0;
        this.lastRetreatTime = this.lastRetreatTime || 0;
        this.retreatDir = this.retreatDir || { x: 0, y: 0 };
        this.approachAttempts = this.approachAttempts || 0;
        this.cornered = this.cornered || false;
        
        // Frustration builds while near the player but not attacking
        if (dist < this.getAggroRange()) {
            this.frustration = Math.min(10, this.frustration + dt * 0.3);
        } else {
            this.frustration = Math.max(0, this.frustration - dt * 0.05); // barely decays
        }
        
        // Cornered detection — if near world edge or structures with player close
        const nearEdge = this.x < 8 || this.x > WORLD_SIZE - 8 || this.y < 8 || this.y > WORLD_SIZE - 8;
        const playerClose = dist < 3;
        this.cornered = nearEdge && playerClose;
        
        // === STATE: CORNERED ===
        // When cornered, all that stored avoidance erupts
        if (this.state === 'cornered_lashing') {
            if (this.stateTimer > 2 || !this.cornered) {
                this.state = 'retreating';
                this.stateTimer = 0;
                this.retreatDir = { x: -dx / (dist || 1), y: -dy / (dist || 1) };
                return;
            }
            // Frantic, wild attacks — faster and harder than normal
            if (dist < this.getAttackRange() * 1.3 && this.attackCooldown <= 0) {
                const storedDmg = this.damage + this.frustration * 1.5;
                if (dist < this.getAttackRange() + 0.5) {
                    player.takeDamage(storedDmg);
                }
                this.setAttackCooldown(this.attackRate * 0.4); // much faster
                this.frustration = Math.max(0, this.frustration - 3);
                camera.addShake(4);
                
                // Panic particles
                for (let i = 0; i < 3; i++) {
                    particles.push({
                        x: this.x, y: this.y,
                        vx: (Math.random() - 0.5) * 4,
                        vy: (Math.random() - 0.5) * 4,
                        type: 'linger_panic',
                        timer: 0.4 + Math.random() * 0.3,
                        size: 2 + Math.random() * 2
                    });
                }
            }
            // Jittering movement — can't stay still
            this.x += (Math.random() - 0.5) * 1.5 * dt;
            this.y += (Math.random() - 0.5) * 1.5 * dt;
            return;
        }
        
        // === STATE: RETREATING ===
        if (this.state === 'retreating') {
            const retreatSpd = this.speed * 1.8 * speedMod;
            this.x += this.retreatDir.x * retreatSpd * dt;
            this.y += this.retreatDir.y * retreatSpd * dt;
            // Add lateral drift — doesn't run straight, slinks sideways
            this.x += Math.sin(TIME.elapsed * 3 + this.bobPhase) * 0.8 * dt;
            
            if (this.stateTimer > 1.2 + this.retreatCount * 0.3) {
                this.state = 'hesitating';
                this.stateTimer = 0;
            }
            
            // Fading trail while retreating
            if (Math.random() < 0.15) {
                particles.push({
                    x: this.x, y: this.y,
                    vx: this.retreatDir.x * 0.5,
                    vy: this.retreatDir.y * 0.5,
                    type: 'linger_fade',
                    timer: 0.6 + Math.random() * 0.4,
                    size: 2 + Math.random() * 2
                });
            }
            return;
        }
        
        // === STATE: HESITATING ===
        if (this.state === 'hesitating') {
            // Stands still, trembles slightly — building up to approach or retreat
            this.x += Math.sin(TIME.elapsed * 5) * 0.1 * dt;
            this.y += Math.cos(TIME.elapsed * 4.3) * 0.08 * dt;
            
            const hesitDuration = 1.5 + this.retreatCount * 0.8; // longer hesitation each time
            if (this.stateTimer > hesitDuration) {
                // Decision point — approach or retreat again?
                const ai = this.getAI();
                const swarmFactor = (ai.swarm ?? 0);
                // swarm reduces retreatChance (more aggressive packs)
                let retreatBase = Math.min(0.8, 0.3 + this.retreatCount * 0.12);
                let retreatChance = Math.max(0.05, retreatBase * (1 - Math.min(0.9, swarmFactor) * 0.65));
                // under restraint, force approach by shrinking retreatChance
                try {
                    if (greyline.getSide() === 'restraint' && greyline.getExtremity() > 0.4) {
                        retreatChance *= 0.2;
                    }
                } catch(e) {}
                if (dist < this.getAggroRange() && Math.random() > retreatChance) {
                    this.state = 'approaching';
                    this.stateTimer = 0;
                    this.approachAttempts++;
                } else if (dist < this.getAggroRange()) {
                    // Retreat again — each time pushes greyline toward restraint
                    this.state = 'retreating';
                    this.stateTimer = 0;
                    this.retreatCount++;
                    this.retreatDir = { x: -dx / (dist || 1), y: -dy / (dist || 1) };
                    this.lastRetreatTime = TIME.elapsed;
                    // The game notices avoidance
                    greyline.push(-1, 0.003);
                } else {
                    this.state = 'idle';
                }
            }
            return;
        }
        
        // === STATE: APPROACHING ===
        if (this.state === 'approaching') {
            if (dist < this.getAggroRange()) {
                // Slow, reluctant approach — speed decreases with retreat count
                const reluctance = Math.max(0.2, 1 - this.retreatCount * 0.15);
                const ai = this.getAI();
                const swarmBoost = 1 + (ai.swarm ?? 0) * 0.65;
                const spd = this.speed * speedMod * reluctance * 0.6 * swarmBoost;
                this.x += (dx / (dist || 1)) * spd * dt;
                this.y += (dy / (dist || 1)) * spd * dt;
                
                // Approach threshold — retreats before reaching attack range if reluctant
                const retreatThreshold = this.attackRange + 0.5 + this.retreatCount * 0.3;
                if (dist < retreatThreshold && this.retreatCount > 0 && Math.random() < 0.02 * this.retreatCount) {
                    this.state = 'retreating';
                    this.stateTimer = 0;
                    this.retreatCount++;
                    this.retreatDir = { x: -dx / (dist || 1), y: -dy / (dist || 1) };
                    this.lastRetreatTime = TIME.elapsed;
                    greyline.push(-1, 0.003);
                    return;
                }
                
                // Actually commits to attack (rare, grows rarer)
                if (dist < this.getAttackRange() && this.attackCooldown <= 0) {
                    // Attack is weak and apologetic — unless frustration is high
                    this.performAttack();
                    // Immediately retreat after attacking
                    this.state = 'retreating';
                    this.stateTimer = 0;
                    this.retreatDir = { x: -dx / (dist || 1), y: -dy / (dist || 1) };
                }
            } else {
                this.state = 'idle';
            }
            return;
        }
        
        // === STATE: IDLE ===
        if (dist < this.getAggroRange()) {
            if (this.cornered) {
                this.state = 'cornered_lashing';
                this.stateTimer = 0;
            } else {
                this.state = 'hesitating';
                this.stateTimer = 0;
            }
        } else {
            // Slow aimless drift when alone
            this.x += Math.sin(TIME.elapsed * 0.3 + this.bobPhase) * 0.2 * dt;
            this.y += Math.cos(TIME.elapsed * 0.25 + this.bobPhase) * 0.15 * dt;
        }
    }
    
    aiWatchful(dt, dx, dy, dist) {
        // Responsibility without reflection. Does not move. Sees too much.
        // Escalates through vigilance stacks the longer the player stays in range.
        // Overcommits — once it starts firing, it can't easily stop.
        
        this.burstCooldown = Math.max(0, this.burstCooldown - dt);
        this.overcommitTimer = Math.max(0, this.overcommitTimer - dt);
        this.warningTimer = Math.max(0, this.warningTimer - dt);
        
        // Slow scan rotation when idle
        this.scanAngle += dt * 0.3;
        
        // Line of sight check (blocked by structures)
        this.hasLineOfSight = true;
        for (const s of world.structures) {
            const cx = s.x + s.w / 2;
            const cy = s.y + s.h / 2;
            // Simple point-to-line distance check
            const toDx = player.x - this.x;
            const toDy = player.y - this.y;
            // we already computed `dist` earlier in this.update; reuse it instead of sqrt
            const toLen = dist || 1;
            const proj = ((cx - this.x) * toDx + (cy - this.y) * toDy) / (toLen * toLen);
            if (proj > 0 && proj < 1) {
                const closestX = this.x + toDx * proj;
                const closestY = this.y + toDy * proj;
                const dx2 = cx - closestX;
                const dy2 = cy - closestY;
                const sDistSq = dx2 * dx2 + dy2 * dy2;
                const threshold = Math.max(s.w, s.h) * 0.6;
                if (sDistSq < threshold * threshold) {
                    this.hasLineOfSight = false;
                    break;
                }
            }
        }
        
        // === STATE: OVERCOMMITTED ===
        // After burst-firing, the Watchful locks up. Vulnerable.
        if (this.state === 'overcommitted') {
            if (this.overcommitTimer <= 0) {
                this.state = 'watching';
                this.vigilanceStacks = Math.max(0, this.vigilanceStacks - 2);
            }
            return; // Can't act — frozen by its own excess
        }
        
        // === STATE: WARNING ===
        // Telegraph before burst — a pulse of light, a moment to dodge
        if (this.state === 'warning') {
            if (this.warningTimer <= 0) {
                if (this._feintPending) {
                    // False tell: compulsion teaches overconfidence; player misreads timing.
                    this._feintPending = false;
                    this.state = 'watching';
                    this.burstCooldown = 0.25 + Math.random() * 0.20;
                    return;
                }
                this.state = 'burst_firing';
                const ai = this.getAI();
                this.burstCount = 2 + Math.min(3, this.vigilanceStacks) + Math.floor((ai.swarm ?? 0) * 2);
                this.burstCooldown = 0;

                // Immediate assurance shot when entering burst_firing (fixes intermittent missing-first-shot behaviour)
                try {
                    const aimDx = player.x - this.x;
                    const aimDy = player.y - this.y;
                    const aimDist = Math.sqrt(aimDx*aimDx + aimDy*aimDy) || 1;
                    const leadTime = aimDist / 5.5;
                    const leadX = player.x + player.vx * leadTime * 0.4;
                    const leadY = player.y + player.vy * leadTime * 0.4;
                    const finalDx = leadX - this.x;
                    const finalDy = leadY - this.y;
                    const finalDist = Math.sqrt(finalDx*finalDx + finalDy*finalDy) || 1;
                    const spread = this.vigilanceStacks * 0.08;
                    const spreadAngle = (Math.random() - 0.5) * spread;
                    const cos = Math.cos(spreadAngle), sin = Math.sin(spreadAngle);
                    const vx = (finalDx / finalDist) * cos - (finalDy / finalDist) * sin;
                    const vy = (finalDx / finalDist) * sin + (finalDy / finalDist) * cos;
                    const projSpeed = 5.0 + this.vigilanceStacks * 0.2;
                    particles.push({ x: this.x, y: this.y, vx: vx * projSpeed, vy: vy * projSpeed, type: 'watchful_bolt', timer: 2.5, damage: this.damage + this.vigilanceStacks * 2, hitRadius: 0.6, sourceId: this.x + this.y * 1000 });
                } catch (e) { /* defensive */ }
            }
            return;
        }
        
        // === STATE: BURST FIRING ===
        if (this.state === 'burst_firing') {
            if (this.burstCount <= 0) {
                // Overcommit — locked out after burst
                this.state = 'overcommitted';
                this.overcommitTimer = 2.5 + this.vigilanceStacks * 0.3;
                return;
            }
            
            if (this.burstCooldown <= 0) {
                // Fire aimed projectile
                const aimDx = player.x - this.x;
                const aimDy = player.y - this.y;
                const aimDist = Math.sqrt(aimDx * aimDx + aimDy * aimDy) || 1;
                
                // Lead the target based on player velocity
                const leadTime = aimDist / 5.5;
                const leadX = player.x + player.vx * leadTime * 0.4;
                const leadY = player.y + player.vy * leadTime * 0.4;
                const finalDx = leadX - this.x;
                const finalDy = leadY - this.y;
                const finalDist = Math.sqrt(finalDx * finalDx + finalDy * finalDy) || 1;
                
                // Spread increases with vigilance (more frantic)
                const spread = this.vigilanceStacks * 0.08;
                const spreadAngle = (Math.random() - 0.5) * spread;
                const cos = Math.cos(spreadAngle);
                const sin = Math.sin(spreadAngle);
                const vx = (finalDx / finalDist) * cos - (finalDy / finalDist) * sin;
                const vy = (finalDx / finalDist) * sin + (finalDy / finalDist) * cos;
                
                const projSpeed = 5.5 + this.vigilanceStacks * 0.3;
                
                particles.push({
                    x: this.x, y: this.y,
                    vx: vx * projSpeed,
                    vy: vy * projSpeed,
                    type: 'watchful_bolt',
                    timer: 2.5,
                    damage: this.damage + this.vigilanceStacks * 2,
                    hitRadius: 0.6,
                    sourceId: this.x + this.y * 1000 // for tracking
                });
                
                this.burstCount--;
                this.burstCooldown = 0.25 - Math.min(0.1, this.vigilanceStacks * 0.02);
                camera.addShake(1.5);
            }
            return;
        }
        
        // === STATE: WATCHING (default) ===
        if (dist < this.getAggroRange() && this.hasLineOfSight) {
            // Track player position
            this.lastSeenPlayerX = player.x;
            this.lastSeenPlayerY = player.y;
            
            // Build vigilance — the longer you linger in its domain, the worse it gets
            this.vigilanceStacks = Math.min(5, this.vigilanceStacks + dt * 0.4);
            
            if (this.attackCooldown <= 0) {
                // Telegraph the burst with a warning state
                this.state = 'warning';
                const ai = this.getAI();
                let warn = 0.6 - Math.min(0.25, this.vigilanceStacks * 0.05);
                warn *= (1.0 + (ai.delay ?? 0) * 0.55);
                this.warningTimer = warn;
                this._feintPending = this.shouldFeint();
                this.setAttackCooldown(this.attackRate - Math.min(0.6, this.vigilanceStacks * 0.12));
            }
        } else {
            // Player left — vigilance decays slowly (responsibility doesn't forget)
            this.vigilanceStacks = Math.max(0, this.vigilanceStacks - dt * 0.15);
            this.state = 'watching';
        }
    }
    
    aiHuddled(dt, dx, dy, dist, speedMod) {
        // CODEPENDENCY AS SAFETY.
        // The Huddled are a collective that can't function apart. In groups, they're coordinated and
        // dangerous — they share damage, buff each other, form siege formations.
        // When allies die nearby, survivors enter grief-rage: faster, stronger, reckless.
        // When isolated, they panic — erratic, self-destructive, desperately seeking others.
        // Psychological message: connection without individuality becomes fragile. The group masks each member's hollowness.
        
        this.griefStacks = this.griefStacks || 0;
        this.griefTimer = this.griefTimer || 0;
        this.siegeAngle = this.siegeAngle || Math.random() * Math.PI * 2;
        this.groupRole = this.groupRole || 'flank'; // flank, front, support
        this.isolationPanic = this.isolationPanic || 0;
        
        // Grief decay
        this.griefTimer = Math.max(0, this.griefTimer - dt);
        if (this.griefTimer <= 0 && this.griefStacks > 0) {
            this.griefStacks = Math.max(0, this.griefStacks - dt * 0.1);
        }
        
        const nearbyHuddled = enemies.filter(e => e !== this && e.type === 'huddled' && !e.dead &&
            Math.sqrt((e.x - this.x)**2 + (e.y - this.y)**2) < 4);
        
        // Check for recently dead nearby huddled — grief trigger
        const deadNearby = enemies.filter(e => e !== this && e.type === 'huddled' && e.dead && 
            e.deathTimer < 1.0 && Math.sqrt((e.x - this.x)**2 + (e.y - this.y)**2) < 5);
        
        if (deadNearby.length > 0 && this.griefTimer <= 0) {
            this.griefStacks = Math.min(5, this.griefStacks + deadNearby.length);
            this.griefTimer = 6; // grief lasts 6 seconds
            
            // Grief scream particles
            for (let i = 0; i < 5; i++) {
                particles.push({
                    x: this.x, y: this.y,
                    vx: (Math.random() - 0.5) * 3,
                    vy: -1 - Math.random() * 2,
                    type: 'huddle_grief',
                    timer: 0.8 + Math.random() * 0.5,
                    size: 2 + Math.random() * 3
                });
            }
        }
        
        const groupSize = nearbyHuddled.length;
        
        if (groupSize > 0) {
            // === GROUPED BEHAVIOR ===
            this.isolationPanic = Math.max(0, this.isolationPanic - dt * 2);
            
            // Assign roles based on position relative to group center
            const groupCX = nearbyHuddled.reduce((s, e) => s + e.x, this.x) / (groupSize + 1);
            const groupCY = nearbyHuddled.reduce((s, e) => s + e.y, this.y) / (groupSize + 1);
            const angleFromCenter = Math.atan2(this.y - groupCY, this.x - groupCX);
            const angleToPlayer = Math.atan2(dy, dx);
            const angleDiff = Math.abs(angleFromCenter - angleToPlayer);
            
            this.groupRole = angleDiff < Math.PI * 0.4 ? 'front' : 
                            angleDiff > Math.PI * 0.8 ? 'support' : 'flank';
            
            // Shared damage buffs — more allies = stronger + tougher
            const dmgBuff = 1 + groupSize * 0.5 + this.griefStacks * 0.8;
            this.damage = 5 * dmgBuff;
            
            if (dist < this.getAggroRange() + groupSize * 1.5) { // larger groups detect from further
                const griefSpeedBuff = 1 + this.griefStacks * 0.25;
                const spd = this.speed * speedMod * griefSpeedBuff;
                
                // Role-specific behavior
                if (this.groupRole === 'front') {
                    // Direct charge at player
                    this.x += (dx / (dist || 1)) * spd * dt;
                    this.y += (dy / (dist || 1)) * spd * dt;
                } else if (this.groupRole === 'flank') {
                    // Arc around to hit from the side
                    this.siegeAngle += dt * 1.5;
                    const flankDist = Math.max(1.5, dist * 0.7);
                    const targetX = player.x + Math.cos(angleToPlayer + Math.PI * 0.5 * (this.siegeAngle > Math.PI ? 1 : -1)) * flankDist;
                    const targetY = player.y + Math.sin(angleToPlayer + Math.PI * 0.5 * (this.siegeAngle > Math.PI ? 1 : -1)) * flankDist;
                    const ftx = targetX - this.x;
                    const fty = targetY - this.y;
                    const ftd = Math.sqrt(ftx * ftx + fty * fty) || 1;
                    this.x += (ftx / ftd) * spd * 0.8 * dt;
                    this.y += (fty / ftd) * spd * 0.8 * dt;
                } else {
                    // Support — stay behind, strengthen others by proximity
                    const stayDist = 2.5;
                    if (dist > stayDist + 1) {
                        this.x += (dx / (dist || 1)) * spd * 0.5 * dt;
                        this.y += (dy / (dist || 1)) * spd * 0.5 * dt;
                    }
                }
                
                // Attack — grief makes them reckless
                if (dist < this.getAttackRange() + this.griefStacks * 0.3 && this.attackCooldown <= 0) {
                    this.performAttack();
                    if (this.griefStacks > 2) {
                        camera.addShake(3);
                    }
                }
            }
            
            // Cohesion — pull toward group center (but not too tight during grief)
            const cohesionDist = this.griefStacks > 2 ? 2.5 : 1.5;
            const gcx = groupCX - this.x;
            const gcy = groupCY - this.y;
            const gcd = Math.sqrt(gcx * gcx + gcy * gcy);
            if (gcd > cohesionDist) {
                this.x += (gcx / gcd) * 0.6 * dt;
                this.y += (gcy / gcd) * 0.6 * dt;
            }
            
            // Separation — don't stack exactly on top of each other
            for (const h of nearbyHuddled) {
                const sx = this.x - h.x;
                const sy = this.y - h.y;
                const sd = Math.sqrt(sx * sx + sy * sy);
                if (sd < 0.8 && sd > 0) {
                    this.x += (sx / sd) * 0.5 * dt;
                    this.y += (sy / sd) * 0.5 * dt;
                }
            }
            
            // Grief visual — pulsing dark aura when mourning
            if (this.griefStacks > 0 && Math.random() < 0.05 * this.griefStacks) {
                particles.push({
                    x: this.x + (Math.random() - 0.5),
                    y: this.y + (Math.random() - 0.5),
                    vx: 0, vy: -0.5,
                    type: 'huddle_grief',
                    timer: 0.4 + Math.random() * 0.3,
                    size: 1.5 + Math.random() * 1.5
                });
            }
            
        } else {
            // === ISOLATED — PANIC ===
            this.isolationPanic = Math.min(5, this.isolationPanic + dt * 0.8);
            this.damage = Math.max(2, 5 - this.isolationPanic);
            
            // Try to find other huddled to run to
            const otherHuddled = enemies.find(e => e !== this && e.type === 'huddled' && !e.dead &&
                Math.sqrt((e.x - this.x)**2 + (e.y - this.y)**2) < 15);
            
            if (otherHuddled) {
                // Desperately run toward allies
                const ax = otherHuddled.x - this.x;
                const ay = otherHuddled.y - this.y;
                const ad = Math.sqrt(ax * ax + ay * ay) || 1;
                const panicSpd = this.speed * 2 * speedMod;
                this.x += (ax / ad) * panicSpd * dt;
                this.y += (ay / ad) * panicSpd * dt;
            } else {
                // No allies in sight — true panic
                // Erratic movement with self-damage from panic
                const panicSpd = 2 + this.isolationPanic * 0.3;
                this.x += (Math.sin(TIME.elapsed * 4 + this.bobPhase) + (Math.random() - 0.5)) * panicSpd * dt;
                this.y += (Math.cos(TIME.elapsed * 3.7 + this.bobPhase) + (Math.random() - 0.5)) * panicSpd * dt;
                
                // Panic self-damage — the isolation is literally killing it
                if (this.isolationPanic > 3) {
                    this.health -= dt * 2;
                    if (Math.random() < 0.08) {
                        particles.push({
                            x: this.x, y: this.y,
                            vx: (Math.random() - 0.5) * 2,
                            vy: -Math.random() * 1.5,
                            type: 'huddle_panic',
                            timer: 0.5,
                            size: 1.5 + Math.random() * 2
                        });
                    }
                }
                
                // Flee from player weakly
                if (dist < 4) {
                    this.x -= (dx / (dist || 1)) * 0.5 * dt;
                    this.y -= (dy / (dist || 1)) * 0.5 * dt;
                }
            }
        }
    }
    
    aiRehearsed(dt, dx, dy, dist, speedMod) {
        // ROUTINE AS DEFENSE.
        // The Rehearsed follows a rigid, predictable combat sequence. Step-step-pause-lunge-recover.
        // Once you learn the pattern, it becomes easy to exploit. But the Rehearsed KNOWS you're
        // exploiting it — and this knowledge accelerates its collapse, not its adaptation.
        // When disrupted (stunned, knocked during a phase), the pattern shatters.
        // A shattered Rehearsed becomes unpredictable and self-destructive.
        // Psychological message: rigidity is not strength. The rehearsed response fails when reality deviates from the script.
        
        this.patternPhase += dt;
        this.patternIntegrity = this.patternIntegrity ?? 1.0; // 1 = perfect, 0 = shattered
        this.cycleCount = this.cycleCount || 0;
        this.disruptCount = this.disruptCount || 0;
        this.isShattered = this.isShattered || false;
        this.shatterTimer = this.shatterTimer || 0;
        this.lungeTargetX = this.lungeTargetX || 0;
        this.lungeTargetY = this.lungeTargetY || 0;
        
        // Pattern integrity degrades when player dodges its attacks or disrupts it
        this.patternIntegrity = Math.max(0, Math.min(1, this.patternIntegrity));
        
        // Shatter recovery — slow, never fully
        if (this.isShattered) {
            this.shatterTimer -= dt;
            if (this.shatterTimer <= 0) {
                this.isShattered = false;
                this.patternIntegrity = Math.max(0.3, this.patternIntegrity); // never fully recovers
                this.patternPhase = 0;
                this.state = 'pattern_approach';
                this.stateTimer = 0;
            }
        }
        
        // === SHATTERED STATE ===
        if (this.isShattered) {
            // Erratic, dangerous, self-destructive
            this.x += (Math.sin(TIME.elapsed * 6 + this.bobPhase) * 2 + (Math.random() - 0.5) * 3) * dt;
            this.y += (Math.cos(TIME.elapsed * 5.3 + this.bobPhase) * 1.5 + (Math.random() - 0.5) * 3) * dt;
            
            // Wild swings at anything nearby
            if (dist < 2.5 && this.attackCooldown <= 0) {
                if (this.shouldFeint()) {
                    // Compulsion mirror: a fake commit that punishes autopilot reactions.
                    this.setAttackCooldown(this.attackRate * (0.20 + Math.random() * 0.40));
                    camera.addShake(2);
                } else {
                    player.takeDamage(this.damage * (1.3 + Math.random() * 0.5)); // unpredictable damage
                this.setAttackCooldown(this.attackRate * (0.3 + Math.random() * 0.7)); // unpredictable timing
                camera.addShake(5);
                }
                
                // Shatter sparks
                for (let i = 0; i < 4; i++) {
                    particles.push({
                        x: this.x, y: this.y,
                        vx: (Math.random() - 0.5) * 5,
                        vy: (Math.random() - 0.5) * 5,
                        type: 'rehearsed_shatter',
                        timer: 0.3 + Math.random() * 0.3,
                        size: 1.5 + Math.random() * 2
                    });
                }
            }
            
            // Self-damage from the chaos
            this.health -= dt * 3;
            
            // Shatter particles
            if (Math.random() < 0.1) {
                particles.push({
                    x: this.x + (Math.random() - 0.5) * 1.5,
                    y: this.y + (Math.random() - 0.5) * 1.5,
                    vx: (Math.random() - 0.5) * 2,
                    vy: -Math.random(),
                    type: 'rehearsed_fragment',
                    timer: 0.5 + Math.random() * 0.3,
                    size: 1 + Math.random() * 2
                });
            }
            return;
        }
        
        if (dist > this.getAggroRange()) {
            // Patrol when idle — walks in precise geometric pattern
            const patrolAngle = this.patternPhase * 0.3;
            this.x += Math.cos(patrolAngle) * 0.3 * dt;
            this.y += Math.sin(patrolAngle) * 0.3 * dt;
            return;
        }
        
        // === PATTERN CYCLE ===
        // Speed up slightly with each successful cycle — building to overconfidence
        const cycleSpeed = 1 + this.cycleCount * 0.08;
        const cycleDuration = 4 / cycleSpeed;
        const phase = (this.patternPhase % cycleDuration) / cycleDuration; // 0→1
        
        // Pattern degrades — phases blur together, timing drifts
        const drift = (1 - this.patternIntegrity) * 0.15;
        
        if (phase < 0.35 + drift) {
            // PHASE 1: Approach — deliberate, measured steps
            this.state = 'pattern_approach';
            const spd = this.speed * speedMod * this.patternIntegrity;
            this.x += (dx / (dist || 1)) * spd * dt;
            this.y += (dy / (dist || 1)) * spd * dt;
            
            // Rhythmic step particles — precise, metronomic
            if (Math.sin(this.patternPhase * 8) > 0.9) {
                particles.push({
                    x: this.x, y: this.y + 0.2,
                    vx: 0, vy: 0,
                    type: 'rehearsed_step',
                    timer: 0.3,
                    size: 3
                });
            }
            
        } else if (phase < 0.45 + drift) {
            // PHASE 2: Telegraph — stops, squares up, brief window to dodge
            this.state = 'pattern_telegraph';
            // Lock onto position — this is where the lunge will aim
            if (phase < 0.36 + drift) {
                this.lungeTargetX = player.x;
                this.lungeTargetY = player.y;
            }
            // Visual: tense stillness, maybe a glint
            
        } else if (phase < 0.6) {
            // PHASE 3: Lunge — committed dash to where player WAS
            this.state = 'pattern_lunge';
            const ltx = this.lungeTargetX - this.x;
            const lty = this.lungeTargetY - this.y;
            const ltd = Math.sqrt(ltx * ltx + lty * lty) || 1;
            const lungeSpd = this.speed * 3.5 * speedMod * (1 + this.cycleCount * 0.1);
            this.x += (ltx / ltd) * lungeSpd * dt;
            this.y += (lty / ltd) * lungeSpd * dt;
            
            if (dist < this.getAttackRange() && this.attackCooldown <= 0) {
                this.performAttack();
                // Player dodged? Pattern awareness degrades
                // (checked in takeDamage response)
            }
            
        } else if (phase < 0.85 - drift) {
            // PHASE 4: Recovery — vulnerable, locked in place
            this.state = 'pattern_recovery';
            // Can't act, can't move — the cost of the rehearsed sequence
            
        } else {
            // Reset — begin next cycle
            if (this.state === 'pattern_recovery') {
                this.cycleCount++;
                // Each cycle completed without being hit boosts integrity slightly
                this.patternIntegrity = Math.min(1, this.patternIntegrity + 0.05);
            }
        }
    }
    
    aiBurdened(dt, dx, dy, dist, speedMod) {
        // WEIGHT AS PURPOSE.
        // The Burdened carries something invisible and enormous. It moves slowly but with terrible inevitability.
        // Its attacks create gravity wells that pull the player in. Each slam exhausts it further —
        // but it cannot stop. To stop carrying is to cease existing.
        // At low health it gets FASTER, not slower — the weight it carried was holding it back.
        // When unburdened by damage, it becomes a frenzied hollow thing.
        // Psychological message: some burdens are load-bearing. Remove them and the structure collapses differently.
        
        this.exhaustion = this.exhaustion || 0;
        this.gravityWells = this.gravityWells || [];
        this.chargeTimer = this.chargeTimer || 0;
        this.isCharging = this.isCharging || false;
        this.chargeDir = this.chargeDir || { x: 0, y: 0 };
        this.unburdened = this.unburdened || false;
        this.groundPoundCooldown = this.groundPoundCooldown || 0;
        
        this.groundPoundCooldown = Math.max(0, this.groundPoundCooldown - dt);
        
        // Clean up gravity wells
        this.gravityWells = this.gravityWells.filter(w => {
            w.timer -= dt;
            w.radius = Math.max(0.5, w.radius - dt * 0.3);
            return w.timer > 0;
        });
        
        // Apply gravity wells to player
        for (const well of this.gravityWells) {
            const wdx = well.x - player.x;
            const wdy = well.y - player.y;
            const wdist = Math.sqrt(wdx * wdx + wdy * wdy);
            if (wdist < well.radius * 3 && wdist > 0.3) {
                const pullStr = 1.5 / (wdist + 0.5);
                // Avoid involuntary player displacement: visualize pull via camera shake instead
                try { camera.addShake(2.0 * pullStr * dt); } catch (e) { /* ignore */ }
                // Spawn subtle pull particles for feedback
                if (Math.random() < 0.25) {
                    particles.push({ x: player.x + (Math.random()-0.5)*0.6, y: player.y + (Math.random()-0.5)*0.6, vx: (wdx/wdist)*0.3, vy: (wdy/wdist)*0.3, type: 'pull_wisp', timer: 0.9, size: 1 });
                }
            }
        }
        
        // Unburdened threshold — losing the weight changes everything
        if (this.health < this.maxHealth * 0.3 && !this.unburdened) {
            this.unburdened = true;
            this.speed = 1.8; // dramatically faster
            this.damage = 12; // weaker hits but rapid
            this.attackRate = 1.0;
            camera.addShake(8);
            
            // Burden shedding burst
            for (let i = 0; i < 10; i++) {
                const angle = (i / 10) * Math.PI * 2;
                particles.push({
                    x: this.x, y: this.y,
                    vx: Math.cos(angle) * 3,
                    vy: Math.sin(angle) * 2 + 0.5,
                    type: 'burden_shed',
                    timer: 1.5 + Math.random() * 1,
                    size: 3 + Math.random() * 4
                });
            }
            
            // The shedding affects the player's burden stat
            psychStats.burden.value = Math.min(1, psychStats.burden.value + 0.1);
        }
        
        if (this.unburdened) {
            // === UNBURDENED — frantic, hollow, fast ===
            if (dist < this.getAggroRange() * 1.5) {
                const spd = this.speed * speedMod * 1.5;
                this.x += (dx / (dist || 1)) * spd * dt;
                this.y += (dy / (dist || 1)) * spd * dt;
                
                // Rapid weak attacks
                if (dist < this.getAttackRange() && this.attackCooldown <= 0) {
                    this.performAttack();
                    this.attackCooldown = this.attackRate * (0.5 + Math.random() * 0.5);
                    camera.addShake(2);
                }
                
                // Crumbling particles — the body falling apart without its anchor
                if (Math.random() < 0.12) {
                    particles.push({
                        x: this.x + (Math.random() - 0.5) * 1.5,
                        y: this.y,
                        vx: (Math.random() - 0.5),
                        vy: 0.5 + Math.random(),
                        type: 'burden_crumble',
                        timer: 0.4 + Math.random() * 0.3,
                        size: 2 + Math.random() * 2
                    });
                }
                
                // Continuous self-damage — unburdened is dying
                this.health -= dt * 1.5;
            }
            return;
        }
        
        // === CHARGING ===
        if (this.isCharging) {
            this.chargeTimer -= dt;
            const chargeSpd = this.speed * 6 * speedMod;
            this.x += this.chargeDir.x * chargeSpd * dt;
            this.y += this.chargeDir.y * chargeSpd * dt;
            
            // Charge damage on contact
            if (dist < 1.5) {
                player.takeDamage(this.damage * 1.5);
                this.isCharging = false;
                this.chargeTimer = 0;
                camera.addShake(10);
                
                // Impact crater — gravity well
                this.gravityWells.push({
                    x: this.x, y: this.y,
                    timer: 3, radius: 2.5
                });
            }
            
            if (this.chargeTimer <= 0) {
                this.isCharging = false;
                // Ground pound at end of charge
                if (this.groundPoundCooldown <= 0) {
                    this.gravityWells.push({
                        x: this.x, y: this.y,
                        timer: 2.5, radius: 2
                    });
                    this.groundPoundCooldown = 5;
                    camera.addShake(6);
                    
                    for (let i = 0; i < 6; i++) {
                        const angle = (i / 6) * Math.PI * 2;
                        particles.push({
                            x: this.x, y: this.y,
                            vx: Math.cos(angle) * 2,
                            vy: Math.sin(angle) * 1,
                            type: 'burden_impact',
                            timer: 0.8 + Math.random() * 0.4,
                            size: 3 + Math.random() * 3
                        });
                    }
                }
                
                this.exhaustion += 10;
            }
            
            // Charge trail
            if (Math.random() < 0.3) {
                particles.push({
                    x: this.x, y: this.y,
                    vx: -this.chargeDir.x * 0.5,
                    vy: 0.5,
                    type: 'burden_trail',
                    timer: 0.5,
                    size: 4
                });
            }
            return;
        }
        
        // === NORMAL PURSUIT ===
        if (dist < this.getAggroRange()) {
            // Exhaustion makes it slower
            const exhaustMod = Math.max(0.4, 1 - this.exhaustion * 0.02);
            const spd = this.speed * speedMod * exhaustMod;
            this.x += (dx / (dist || 1)) * spd * dt;
            this.y += (dy / (dist || 1)) * spd * dt;
            
            // Heavy footstep particles
            if (Math.sin(TIME.elapsed * 3) > 0.95) {
                particles.push({
                    x: this.x, y: this.y + 0.3,
                    vx: 0, vy: 0,
                    type: 'burden_step',
                    timer: 0.6,
                    size: 5
                });
            }
            
            // Melee slam — creates gravity well
            if (dist < this.getAttackRange() && this.attackCooldown <= 0) {
                this.performAttack();
                camera.addShake(8);
                this.health -= 3; // self-damage from exertion
                this.exhaustion += 5;
                
                // Slam creates pull
                this.gravityWells.push({
                    x: player.x, y: player.y,
                    timer: 2, radius: 1.5
                });
            }
            
            // Charge decision — winds up for devastating rush
            if (dist > 4 && dist < 8 && this.exhaustion < 30 && this.attackCooldown <= 0 && Math.random() < 0.008) {
                this.isCharging = true;
                this.chargeTimer = 0.8;
                const d = Math.sqrt(dx * dx + dy * dy) || 1;
                this.chargeDir = { x: dx / d, y: dy / d };
                this.state = 'charging';
            }
            
            // Exhaustion recovery (slow)
            this.exhaustion = Math.max(0, this.exhaustion - dt * 0.5);
            
        } else {
            // Trudges aimlessly — the weight doesn't let it rest
            this.x += Math.sin(TIME.elapsed * 0.15 + this.bobPhase) * 0.15 * dt;
            this.y += Math.cos(TIME.elapsed * 0.12 + this.bobPhase) * 0.1 * dt;
            this.exhaustion = Math.max(0, this.exhaustion - dt * 1);
        }
    }
    
    aiDrifting(dt, dx, dy, dist, speedMod) {
        // Surrender mistaken for peace. Circles, harasses, never commits.
        // The danger is interruption — it strikes when you're focused elsewhere.
        // Punishes tunnel vision. Rewards peripheral awareness.
        
        this.disengageTimer = Math.max(0, this.disengageTimer - dt);
        const angleToPlayer = Math.atan2(dy, dx);
        
        // Track whether player is engaged with another enemy
        const playerBusy = enemies.some(e => e !== this && !e.dead && e.type !== 'drifting' &&
            Math.sqrt((e.x - player.x) ** 2 + (e.y - player.y) ** 2) < 3);
        
        // === STATE: DISENGAGING ===
        // After a lunge, rapidly retreat — never stay close
        if (this.state === 'disengaging') {
            const fleeAngle = angleToPlayer + Math.PI; // away from player
            const fleeDrift = Math.sin(TIME.elapsed * 4 + this.bobPhase) * 0.8; // erratic retreat
            this.x += Math.cos(fleeAngle + fleeDrift) * this.speed * 1.5 * speedMod * dt;
            this.y += Math.sin(fleeAngle + fleeDrift) * this.speed * 1.5 * speedMod * dt;
            
            if (this.disengageTimer <= 0 || dist > 5) {
                this.state = 'orbiting';
                this.orbitDir *= -1; // reverse orbit direction after each lunge
            }
            return;
        }
        
        // === STATE: LUNGING ===
        // Committed dash toward the player — brief, lethal window
        if (this.state === 'lunging') {
            if (this.dashTarget) {
                const ltx = this.dashTarget.x - this.x;
                const lty = this.dashTarget.y - this.y;
                const ltDist = Math.sqrt(ltx * ltx + lty * lty);
                
                if (ltDist > 0.3) {
                    const lungeSpeed = this.speed * 3.5 * speedMod;
                    this.x += (ltx / ltDist) * lungeSpeed * dt;
                    this.y += (lty / ltDist) * lungeSpeed * dt;
                }
                
                // Hitbox check — wider during lunge for a sweeping pass
                const hitDx = player.x - this.x;
                const hitDy = player.y - this.y;
                const hitDist = Math.sqrt(hitDx * hitDx + hitDy * hitDy);
                
                if (hitDist < this.attackRange) {
                    player.takeDamage(this.damage);
                    this.setAttackCooldown(this.attackRate);
                    this.harassCount++;
                    this.lastHarassTime = TIME.elapsed;
                    
                    // Each successive harass within 8 seconds pushes greyline toward compulsion
                    // — the drifting makes you reactive, frantic, chasing ghosts
                    if (this.harassCount > 2) {
                        greyline.push(1, 0.01 * this.harassCount);
                    }
                    
                    // Spawn disorientation particles at hit location
                    for (let i = 0; i < 4; i++) {
                        particles.push({
                            x: player.x, y: player.y,
                            vx: (Math.random() - 0.5) * 4,
                            vy: (Math.random() - 0.5) * 4,
                            type: 'drift_wisp',
                            timer: 0.6 + Math.random() * 0.4,
                            size: 3 + Math.random() * 3
                        });
                    }
                }
                
                // Lunge completes — disengage whether hit or miss
                if (ltDist < 0.5 || this.stateTimer > 0.5) {
                    this.state = 'disengaging';
                    this.disengageTimer = 0.8 + Math.random() * 0.4;
                    this.dashTarget = null;
                }
            } else {
                this.state = 'orbiting';
            }
            return;
        }
        
        // === STATE: ORBITING (default) ===
        if (dist < this.getAggroRange()) {
            this.state = 'orbiting';
            
            // Decay harass count over time
            if (TIME.elapsed - this.lastHarassTime > 8) {
                this.harassCount = Math.max(0, this.harassCount - 1);
                this.lastHarassTime = TIME.elapsed;
            }
            
            // Orbit the player at varying distance
            const preferredDist = playerBusy ? 3.0 : 4.5; // closer when player is distracted
            const orbitSpeed = 1.8 + (playerBusy ? 0.6 : 0); // faster orbit when hunting
            this.orbitAngle += this.orbitDir * orbitSpeed * dt;
            
            // Breathe the orbit radius in and out
            const orbitRadius = preferredDist + Math.sin(this.bobPhase * 0.7) * 1.2;
            const targetX = player.x + Math.cos(this.orbitAngle) * orbitRadius;
            const targetY = player.y + Math.sin(this.orbitAngle) * orbitRadius;
            
            const toTargetX = targetX - this.x;
            const toTargetY = targetY - this.y;
            const toTargetDist = Math.sqrt(toTargetX * toTargetX + toTargetY * toTargetY) || 1;
            
            const spd = this.speed * speedMod;
            this.x += (toTargetX / toTargetDist) * spd * dt;
            this.y += (toTargetY / toTargetDist) * spd * dt;
            
            // Lunge decision — the Drifting strikes when:
            // 1) Player is busy fighting something else (opportunist)
            // 2) Player just used a skill (punish commitment)
            // 3) Enough orbit time has passed (won't wait forever)
            const playerJustActed = player.state === 'attacking' || player.state === 'attune';
            const orbitedLong = this.stateTimer > 3 + Math.random() * 2;
            const closeEnough = dist < 5;
            
            if (this.attackCooldown <= 0 && closeEnough && 
                (playerBusy || playerJustActed || orbitedLong)) {
                // Commit to lunge — aim slightly ahead of player
                this.state = 'lunging';
                this.stateTimer = 0;
                this.dashTarget = {
                    x: player.x + player.vx * 0.3,
                    y: player.y + player.vy * 0.3
                };
                
                // Lunge trail particles
                for (let i = 0; i < 3; i++) {
                    particles.push({
                        x: this.x, y: this.y,
                        vx: (Math.random() - 0.5) * 1.5,
                        vy: (Math.random() - 0.5) * 1.5,
                        type: 'drift_wisp',
                        timer: 0.4 + Math.random() * 0.3,
                        size: 2 + Math.random() * 2
                    });
                }
            }
        } else {
            // Out of range — drift aimlessly, slowly spiraling toward player
            this.state = 'drifting';
            this.orbitAngle += this.orbitDir * 0.5 * dt;
            const wanderX = this.x + Math.cos(this.orbitAngle) * 0.5;
            const wanderY = this.y + Math.sin(this.orbitAngle) * 0.5;
            const wdx = (player.x + (wanderX - this.x) * 5) - this.x;
            const wdy = (player.y + (wanderY - this.y) * 5) - this.y;
            const wdist = Math.sqrt(wdx * wdx + wdy * wdy) || 1;
            this.x += (wdx / wdist) * this.speed * 0.3 * dt;
            this.y += (wdy / wdist) * this.speed * 0.3 * dt;
        }
    }
    
    aiDeferred(dt, dx, dy, dist) {
        // ACCUMULATED COST MADE MANIFEST.
        // The Deferred doesn't move. It sits. It looks harmless — curled, dormant, almost pitiful.
        // But it's been accumulating. Every second it exists unaddressed, its internal pressure builds.
        // When the player finally gets close enough to "deal with it," the cost of all that deferral
        // erupts — not as a fair fight, but as a sudden, disproportionate explosion of everything
        // that was avoided.
        // After erupting, it's spent and vulnerable. But if the player walks away, it begins
        // accumulating again, faster this time. It learned that deferral works.
        // Psychological message: ignored responsibilities don't shrink. They compound.
        
        this.accumulatedCost = this.accumulatedCost || 0;
        this.eruptionCount = this.eruptionCount || 0;
        this.isErupting = this.isErupting || false;
        this.eruptionTimer = this.eruptionTimer || 0;
        this.spentTimer = this.spentTimer || 0;
        this.isSpent = this.isSpent || false;
        this.nearMissTimer = this.nearMissTimer || 0;
        this.playerAwareTimer = this.playerAwareTimer || 0;
        this.trembleIntensity = this.trembleIntensity || 0;
        
        // === ACCUMULATION — the core mechanic ===
        // Builds faster each time it's been erupted and survived
        const accumRate = 0.5 + this.eruptionCount * 0.3;
        
        if (!this.isErupting && !this.isSpent) {
            this.accumulatedCost = Math.min(20, this.accumulatedCost + dt * accumRate);
            
            // Tremor increases with accumulated cost — visual tell
            this.trembleIntensity = (this.accumulatedCost / 20) * 0.8;
            
            // The game notices when the player is near but not engaging
            if (dist < 6) {
                this.playerAwareTimer += dt;
                // Player proximity accelerates accumulation — the problem grows faster 
                // the closer you are to dealing with it without actually dealing with it
                this.accumulatedCost = Math.min(20, this.accumulatedCost + dt * 0.3);
                
                // Pressure particles — something building inside
                if (this.accumulatedCost > 5 && Math.random() < 0.04 * (this.accumulatedCost / 20)) {
                    particles.push({
                        x: this.x + (Math.random() - 0.5) * 0.8,
                        y: this.y + (Math.random() - 0.5) * 0.5,
                        vx: 0,
                        vy: -0.3 - Math.random() * 0.3,
                        type: 'deferred_pressure',
                        timer: 0.5 + Math.random() * 0.4,
                        size: 1 + (this.accumulatedCost / 20) * 2
                    });
                }
                
                // Near-miss tracking — player came close then retreated
                // This is how deferral rewires: "see? you didn't have to deal with it"
            } else if (this.playerAwareTimer > 1) {
                // Player left after being near — deferral reinforced
                this.nearMissTimer = 3;
                this.playerAwareTimer = 0;
                // Deferral pushes greyline toward restraint
                greyline.push(-1, 0.005 * this.eruptionCount);
            }
            
            this.nearMissTimer = Math.max(0, this.nearMissTimer - dt);
        }
        
        // === ERUPTION TRIGGER — proximity threshold ===
        if (!this.isErupting && !this.isSpent && dist < this.getAggroRange()) {
            this.state = 'triggered';
            this.stateTimer = 0;
        }
        
        if (this.state === 'triggered' && !this.isErupting && !this.isSpent) {
            // Brief unfold / warning
            if (this.stateTimer < 0.4) {
                // Unfolding — the cost revealing its true size
                // Tremor intensifies
                this.trembleIntensity = Math.min(1, this.trembleIntensity + dt * 3);
                
                // Warning particles — the lid coming off
                if (Math.random() < 0.2) {
                    particles.push({
                        x: this.x, y: this.y,
                        vx: (Math.random() - 0.5) * 2,
                        vy: -1 - Math.random(),
                        type: 'deferred_unfurl',
                        timer: 0.3 + Math.random() * 0.2,
                        size: 2 + Math.random() * 2
                    });
                }
            } else {
                // === ERUPTION — everything deferred pays out at once ===
                this.isErupting = true;
                this.eruptionTimer = 1.5 + this.accumulatedCost * 0.1;
                this.state = 'erupting';
                this.stateTimer = 0;
                
                camera.addShake(4 + this.accumulatedCost * 0.4);
                
                // Initial eruption blast
                const blastDmg = 5 + this.accumulatedCost * 1.5;
                if (dist < 3) {
                    player.takeDamage(blastDmg);
                }
                
                // Eruption burst particles — the stored cost made visible
                const burstCount = 6 + Math.floor(this.accumulatedCost);
                for (let i = 0; i < burstCount; i++) {
                    const angle = (i / burstCount) * Math.PI * 2 + Math.random() * 0.3;
                    const speed = 1.5 + Math.random() * (2 + this.accumulatedCost * 0.2);
                    particles.push({
                        x: this.x, y: this.y,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed * 0.6 - Math.random(),
                        type: 'deferred_eruption',
                        timer: 0.6 + Math.random() * 0.8,
                        size: 2 + Math.random() * (1 + this.accumulatedCost * 0.15)
                    });
                }
                
                // Greyline impact — eruption pushes compulsion (forced confrontation)
                greyline.push(1, 0.02 + this.accumulatedCost * 0.003);
                
                // Psychstat impact — being blindsided degrades integrity
                psychStats.integrity.value -= 0.02 * (this.accumulatedCost / 20);
            }
        }
        
        // === ERUPTING STATE — sustained damage zone ===
        if (this.isErupting) {
            this.eruptionTimer -= dt;
            
            // Pulsing damage waves
            const pulsePhase = Math.sin(TIME.elapsed * 8);
            if (pulsePhase > 0.8 && this.attackCooldown <= 0) {
                // Damage pulse
                const pulseDmg = 3 + this.accumulatedCost * 0.5;
                const pulseRange = 2 + this.accumulatedCost * 0.1;
                if (dist < pulseRange) {
                    player.takeDamage(pulseDmg);
                }
                this.attackCooldown = 0.6;
                
                // Pulse ring particle
                particles.push({
                    x: this.x, y: this.y,
                    vx: 0, vy: 0,
                    type: 'deferred_pulse',
                    timer: 0.4,
                    size: pulseRange * TILE_W * 0.35
                });
            }
            
            // Continuous leak particles
            if (Math.random() < 0.15) {
                particles.push({
                    x: this.x + (Math.random() - 0.5) * 2,
                    y: this.y + (Math.random() - 0.5),
                    vx: (Math.random() - 0.5) * 3,
                    vy: -1.5 - Math.random() * 2,
                    type: 'deferred_eruption',
                    timer: 0.3 + Math.random() * 0.3,
                    size: 1.5 + Math.random() * 2
                });
            }
            
            // The eruption consumes the Deferred — self-damage
            this.health -= dt * 2;
            
            if (this.eruptionTimer <= 0) {
                // Eruption spent — collapsed, depleted, vulnerable
                this.isErupting = false;
                this.isSpent = true;
                this.spentTimer = 4;
                this.state = 'spent';
                this.stateTimer = 0;
                this.accumulatedCost = 0;
                this.eruptionCount++;
                this.trembleIntensity = 0;
            }
        }
        
        // === SPENT STATE — vulnerability window ===
        if (this.isSpent) {
            this.spentTimer -= dt;
            // Cannot act. Can only be hit. The cost of everything catching up.
            
            if (this.spentTimer <= 0) {
                // Begins re-accumulating — the cycle continues
                this.isSpent = false;
                this.state = 'idle';
                this.stateTimer = 0;
                this.playerAwareTimer = 0;
                // It remembered that deferral worked before — accumulates faster now
            }
        }
        
        // === IDLE — dormant, accumulating, seemingly harmless ===
        if (this.state === 'idle' || (this.state !== 'triggered' && this.state !== 'erupting' && this.state !== 'spent')) {
            // Tiny tremor based on accumulated cost
            this.x += Math.sin(TIME.elapsed * 6 + this.bobPhase) * this.trembleIntensity * 0.05 * dt;
            this.y += Math.cos(TIME.elapsed * 5.3 + this.bobPhase) * this.trembleIntensity * 0.03 * dt;
        }
    }
    
    aiRemembered(dt, dx, dy, dist, speedMod) {
        // THE ECHO THAT LEARNED YOU.
        // The Remembered doesn't fight like an enemy. It fights like the player — on a delay.
        // It records the player's actions (movement, attacks, skill usage) and replays them
        // after a time lag. The better you play, the more dangerous it becomes.
        // It maintains a "discomfort distance" — too close and it backs off. Too far and it approaches.
        // Never quite where you expect. Always familiar.
        // When it attacks, it uses a distorted version of whatever you did recently.
        // Killing it feels wrong because it dies like the player might — flinching, trying to dash away.
        // Psychological message: you can't outrun yourself. The parts you disown learn from watching you.
        
        // === ACTION MEMORY — records player behavior ===
        this.actionMemory = this.actionMemory || [];
        this.memoryPlaybackIndex = this.memoryPlaybackIndex || 0;
        this.recordTimer = this.recordTimer || 0;
        this.mirrorDelay = this.mirrorDelay ?? 1.5; // seconds of delay before replaying
        this.mirrorFidelity = this.mirrorFidelity ?? 0.6; // how accurately it copies (rises over time)
        this.discomfortDist = this.discomfortDist || 3; // preferred distance
        this.uncanniness = this.uncanniness || 0; // accumulates as it copies more
        this.lastPlayerState = this.lastPlayerState || 'idle';
        this.echoAttackTimer = this.echoAttackTimer || 0;
        this.echoDashTimer = this.echoDashTimer || 0;
        this.echoDashDir = this.echoDashDir || { x: 0, y: 0 };
        this.observeTimer = this.observeTimer || 0;
        this.mimicState = this.mimicState || 'observing';
        
        // === RECORD PLAYER ACTIONS ===
        this.recordTimer += dt;
        if (this.recordTimer > 0.2) {
            this.recordTimer = 0;
            // Record snapshot
            const snapshot = {
                time: TIME.elapsed,
                x: player.x,
                y: player.y,
                vx: player.vx,
                vy: player.vy,
                state: player.state,
                facing: player.facing,
                attacked: player.state === 'attacking' && this.lastPlayerState !== 'attacking',
                dashed: player.state === 'dashing' && this.lastPlayerState !== 'dashing',
            };
            this.actionMemory.push(snapshot);
            this.lastPlayerState = player.state;
            
            // Keep memory bounded — older memories fade
            if (this.actionMemory.length > 50) {
                this.actionMemory.shift();
            }
        }
        
        // Mirror fidelity grows the longer it watches — it's learning
        if (dist < this.getAggroRange()) {
            this.mirrorFidelity = Math.min(0.95, this.mirrorFidelity + dt * 0.01);
            this.uncanniness = Math.min(1, this.uncanniness + dt * 0.005);
            this.observeTimer += dt;
        }
        
        // Mirror delay shortens as fidelity improves — reactions become unnervingly quick
        this.mirrorDelay = Math.max(0.4, 1.5 - this.mirrorFidelity * 1.0);
        
        // === FIND DELAYED ACTION TO REPLAY ===
        const targetTime = TIME.elapsed - this.mirrorDelay;
        let delayedAction = null;
        for (let i = this.actionMemory.length - 1; i >= 0; i--) {
            if (this.actionMemory[i].time <= targetTime) {
                delayedAction = this.actionMemory[i];
                break;
            }
        }
        
        if (dist < this.getAggroRange()) {
            const spd = this.speed * speedMod;
            
            // === ECHO DASH (mirror of player's dash) ===
            if (this.echoDashTimer > 0) {
                this.echoDashTimer -= dt;
                const echoDashSpd = 10 * this.mirrorFidelity;
                this.x += this.echoDashDir.x * echoDashSpd * dt;
                this.y += this.echoDashDir.y * echoDashSpd * dt;
                
                // Echo trail — darker, wronger version of player's dash
                if (Math.random() < 0.4) {
                    particles.push({
                        x: this.x, y: this.y,
                        vx: -this.echoDashDir.x * 1.5 + (Math.random() - 0.5),
                        vy: -this.echoDashDir.y * 1.5 + (Math.random() - 0.5),
                        type: 'remembered_echo',
                        timer: 0.3 + Math.random() * 0.2,
                        size: 2 + Math.random() * 2
                    });
                }
                
                if (this.echoDashTimer <= 0) {
                    this.mimicState = 'observing';
                }
                return;
            }
            
            // === ECHO ATTACK ===
            if (this.echoAttackTimer > 0) {
                this.echoAttackTimer -= dt;
                // During echo attack, lunge briefly toward player's remembered position
                if (delayedAction) {
                    const aDx = delayedAction.x - this.x;
                    const aDy = delayedAction.y - this.y;
                    const aDist = Math.sqrt(aDx * aDx + aDy * aDy) || 1;
                    if (aDist > 0.5) {
                        this.x += (aDx / aDist) * spd * 2 * dt;
                        this.y += (aDy / aDist) * spd * 2 * dt;
                    }
                }
                
                // Hit check at apex
                if (this.echoAttackTimer < 0.1 && dist < this.getAttackRange() + 0.3) {
                    const echoDmg = this.damage * (0.5 + this.mirrorFidelity * 0.8);
                    player.takeDamage(echoDmg);
                    camera.addShake(3);
                    
                    // Attack echo particles
                    for (let i = 0; i < 3; i++) {
                        particles.push({
                            x: this.x + (Math.random() - 0.5) * 0.5,
                            y: this.y - 0.5,
                            vx: (dx / (dist || 1)) * 2 + (Math.random() - 0.5),
                            vy: -0.5 - Math.random(),
                            type: 'remembered_strike',
                            timer: 0.3 + Math.random() * 0.2,
                            size: 2 + Math.random() * 2
                        });
                    }
                }
                
                if (this.echoAttackTimer <= 0) {
                    this.mimicState = 'observing';
                    this.attackCooldown = this.attackRate * (1.5 - this.mirrorFidelity * 0.6);
                }
                return;
            }
            
            // === REPLAY DELAYED ACTIONS ===
            if (delayedAction && this.attackCooldown <= 0) {
                // Mirror dash
                if (delayedAction.dashed && Math.random() < this.mirrorFidelity) {
                    this.echoDashTimer = 0.15;
                    this.echoDashDir = {
                        x: delayedAction.vx !== 0 ? Math.sign(delayedAction.vx) : (Math.random() - 0.5),
                        y: delayedAction.vy !== 0 ? Math.sign(delayedAction.vy) : (Math.random() - 0.5)
                    };
                    const dLen = Math.sqrt(this.echoDashDir.x ** 2 + this.echoDashDir.y ** 2) || 1;
                    this.echoDashDir.x /= dLen;
                    this.echoDashDir.y /= dLen;
                    this.mimicState = 'echo_dashing';
                    return;
                }
                
                // Mirror attack
                if (delayedAction.attacked && dist < 4 && Math.random() < this.mirrorFidelity) {
                    this.echoAttackTimer = 0.25;
                    this.mimicState = 'echo_attacking';
                    this.facing = dx > 0 ? 1 : -1;
                    this.facingDir = angleToDir8(Math.atan2(dy, dx));
                    return;
                }
            }
            
            // === MOVEMENT — maintain discomfort distance ===
            // The Remembered keeps a specific distance. Not too close (it's observing), 
            // not too far (it needs to learn). The distance itself makes you uneasy.
            const discomfortMargin = 0.8;
            
            if (dist > this.discomfortDist + discomfortMargin) {
                // Approach — but mirror player movement direction when possible
                if (delayedAction && Math.random() < this.mirrorFidelity * 0.5) {
                    // Echo player's old movement
                    this.x += delayedAction.vx * 0.5 * dt * this.mirrorFidelity;
                    this.y += delayedAction.vy * 0.5 * dt * this.mirrorFidelity;
                }
                // Also approach directly
                this.x += (dx / (dist || 1)) * spd * 0.8 * dt;
                this.y += (dy / (dist || 1)) * spd * 0.8 * dt;
            } else if (dist < this.discomfortDist - discomfortMargin) {
                // Back away — matching player's facing, like a mirror in retreat
                this.x -= (dx / (dist || 1)) * spd * 0.6 * dt;
                this.y -= (dy / (dist || 1)) * spd * 0.6 * dt;
            } else {
                // At discomfort distance — orbit slowly, studying
                const orbitAngle = Math.atan2(dy, dx) + Math.PI / 2;
                this.x += Math.cos(orbitAngle) * spd * 0.4 * dt;
                this.y += Math.sin(orbitAngle) * spd * 0.4 * dt;
            }
            
            // Mirror player facing — unsettlingly
            this.facing = player.facing;
            this.facingDir = player.facingDir;
            
            // Uncanny presence effect — the longer it watches, the more the player's 
            // precision decays. Being studied makes you self-conscious.
            if (this.uncanniness > 0.3 && dist < 6) {
                psychStats.precision.value -= 0.002 * this.uncanniness * dt;
                
                // Mirror shimmer particles — barely visible
                if (Math.random() < 0.02 * this.uncanniness) {
                    particles.push({
                        x: this.x + (Math.random() - 0.5),
                        y: this.y - 1 + (Math.random() - 0.5),
                        vx: 0, vy: -0.2,
                        type: 'remembered_shimmer',
                        timer: 0.5 + Math.random() * 0.3,
                        size: 2 + Math.random() * 2
                    });
                }
            }
        } else {
            // Out of range — drifts toward player, slowly, inevitably
            this.mimicState = 'approaching';
            const spd = this.speed * speedMod * 0.3;
            this.x += (dx / (dist || 1)) * spd * dt;
            this.y += (dy / (dist || 1)) * spd * dt;
        }
    }
    
    performAttack() {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < this.getAttackRange() + 0.5) {
            player.takeDamage(this.damage);
        }
        this.setAttackCooldown(this.attackRate);
    }
    
    performRangedAttack(dx, dy, dist) {
        // Projectile
        const speed = 4;
        particles.push({
            x: this.x, y: this.y,
            vx: (dx / dist) * speed,
            vy: (dy / dist) * speed,
            type: 'projectile',
            timer: 3,
            damage: this.damage
        });
        this.setAttackCooldown(this.attackRate);
    }
    
    takeDamage(amount, fromX, fromY) {
        const dx = this.x - fromX;
        const dy = this.y - fromY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        
        let finalDmg = amount;
        let knockMult = 1.0;
        
        // ── TYPE-SPECIFIC DAMAGE RESPONSE ──
        
        if (this.type === 'lingering') {
            // The Lingering flinches from damage — retreats harder, frustration spikes
            // Being hit makes it MORE avoidant, not less
            finalDmg *= 1.0;
            knockMult = 1.5; // flies back easily — fragile presence
            
            this.frustration = (this.frustration || 0) + amount * 0.15;
            
            // Force retreat if not already cornered
            if (this.state !== 'cornered_lashing') {
                this.state = 'retreating';
                this.stateTimer = 0;
                this.retreatDir = { x: dx / dist, y: dy / dist };
                this.retreatCount = (this.retreatCount || 0) + 1;
            } else {
                // Cornered and hit — frustration erupts faster
                this.frustration = Math.min(10, (this.frustration || 0) + 2);
                camera.addShake(2);
            }
            
            // Flinch particles — scattering away from impact
            for (let i = 0; i < 2; i++) {
                particles.push({
                    x: this.x, y: this.y,
                    vx: (dx / dist) * 2 + (Math.random() - 0.5),
                    vy: -0.5 - Math.random(),
                    type: 'linger_fade',
                    timer: 0.4 + Math.random() * 0.3,
                    size: 1.5 + Math.random() * 2
                });
            }
            
            // Low health — final desperate approach
            if (this.health - finalDmg < this.maxHealth * 0.25 && this.health >= this.maxHealth * 0.25) {
                this.frustration = 10;
                this.retreatCount = 0; // stops retreating — no more running
            }
        }
        
        if (this.type === 'huddled') {
            // Damage triggers grief in nearby huddled even if this one doesn't die
            // The group feels each hit
            const nearbyHuddled = enemies.filter(e => e !== this && e.type === 'huddled' && !e.dead &&
                Math.sqrt((e.x - this.x)**2 + (e.y - this.y)**2) < 5);
            
            if (nearbyHuddled.length > 0) {
                // Protected by the group — takes less damage but the group tightens
                finalDmg *= Math.max(0.5, 1 - nearbyHuddled.length * 0.12);
                knockMult = 0.6; // group anchors it
                
                // Group flinch — all nearby Huddled twitch toward this one
                for (const h of nearbyHuddled) {
                    const hDx = this.x - h.x;
                    const hDy = this.y - h.y;
                    const hDist = Math.sqrt(hDx * hDx + hDy * hDy) || 1;
                    h.knockbackX += (hDx / hDist) * 0.5;
                    h.knockbackY += (hDy / hDist) * 0.5;
                    // Group anger builds
                    h.griefStacks = Math.min(5, (h.griefStacks || 0) + 0.3);
                }
            } else {
                // Isolated — takes MORE damage, panic intensifies
                finalDmg *= 1.3;
                knockMult = 1.5;
                this.isolationPanic = Math.min(5, (this.isolationPanic || 0) + 1);
                
                // Panic scatter
                for (let i = 0; i < 3; i++) {
                    particles.push({
                        x: this.x, y: this.y,
                        vx: (Math.random() - 0.5) * 3,
                        vy: -1 - Math.random(),
                        type: 'huddle_panic',
                        timer: 0.3 + Math.random() * 0.3,
                        size: 1.5 + Math.random() * 2
                    });
                }
            }
        }
        
        if (this.type === 'rehearsed') {
            // Damage during specific phases has different effects
            if (this.state === 'pattern_recovery') {
                // Caught in recovery — vulnerable, bonus damage
                finalDmg *= 1.5;
                knockMult = 1.3;
                // Each hit during recovery degrades pattern integrity
                this.patternIntegrity = Math.max(0, (this.patternIntegrity || 1) - 0.15);
            } else if (this.state === 'pattern_lunge') {
                // Mid-commit — can disrupt into shatter
                finalDmg *= 1.0;
                this.disruptCount = (this.disruptCount || 0) + 1;
                this.patternIntegrity = Math.max(0, (this.patternIntegrity || 1) - 0.2);
                
                // Disruption sparks
                for (let i = 0; i < 3; i++) {
                    particles.push({
                        x: this.x, y: this.y,
                        vx: (Math.random() - 0.5) * 4,
                        vy: (Math.random() - 0.5) * 3,
                        type: 'rehearsed_shatter',
                        timer: 0.3 + Math.random() * 0.2,
                        size: 1.5 + Math.random() * 2
                    });
                }
            } else if (this.state === 'pattern_telegraph') {
                // Hit during telegraph — strongest disruption
                finalDmg *= 1.2;
                this.patternIntegrity = Math.max(0, (this.patternIntegrity || 1) - 0.25);
                this.disruptCount = (this.disruptCount || 0) + 1;
            } else if (this.state === 'pattern_approach') {
                // Normal damage during approach
                finalDmg *= 0.9;
                knockMult = 0.8;
            }
            
            // Shatter trigger — integrity below threshold
            if ((this.patternIntegrity || 1) < 0.2 && !this.isShattered) {
                this.isShattered = true;
                this.shatterTimer = 4 + Math.random() * 2;
                camera.addShake(6);
                
                // Pattern collapse burst
                for (let i = 0; i < 8; i++) {
                    const angle = (i / 8) * Math.PI * 2;
                    particles.push({
                        x: this.x, y: this.y,
                        vx: Math.cos(angle) * 3 + (Math.random() - 0.5),
                        vy: Math.sin(angle) * 2 + (Math.random() - 0.5),
                        type: 'rehearsed_fragment',
                        timer: 0.6 + Math.random() * 0.5,
                        size: 2 + Math.random() * 3
                    });
                }
            }
        }
        
        if (this.type === 'burdened') {
            // The Burdened barely reacts to damage — weight absorbs impact
            if (!this.unburdened) {
                finalDmg *= 0.8; // armored by its burden
                knockMult = 0.3; // barely budges
                
                // But damage increases exhaustion
                this.exhaustion = (this.exhaustion || 0) + amount * 0.2;
                
                // Weight fragment on hit
                if (Math.random() < 0.4) {
                    particles.push({
                        x: this.x + (Math.random() - 0.5),
                        y: this.y,
                        vx: (dx / dist) * 1.5,
                        vy: 0.5 + Math.random(),
                        type: 'burden_crumble',
                        timer: 0.4 + Math.random() * 0.3,
                        size: 2 + Math.random() * 2
                    });
                }
            } else {
                // Unburdened — fragile, takes MORE damage
                finalDmg *= 1.4;
                knockMult = 2.0; // flies around now that the weight is gone
                
                // Hollow crumble particles
                for (let i = 0; i < 3; i++) {
                    particles.push({
                        x: this.x + (Math.random() - 0.5),
                        y: this.y,
                        vx: (dx / dist) * 2 + (Math.random() - 0.5) * 2,
                        vy: 0.3 + Math.random(),
                        type: 'burden_crumble',
                        timer: 0.3 + Math.random() * 0.3,
                        size: 1.5 + Math.random() * 2
                    });
                }
            }
        }
        
        if (this.type === 'deferred') {
            // Damage response depends on state
            if (this.isSpent) {
                // Spent — fully vulnerable, bonus damage
                finalDmg *= 1.8;
                knockMult = 1.5;
            } else if (this.isErupting) {
                // Mid-eruption — can be interrupted with enough force
                finalDmg *= 1.0;
                if (finalDmg > this.maxHealth * 0.2) {
                    this.eruptionTimer -= 0.5; // heavy hits shorten eruption
                }
            } else {
                // Dormant — damage is normal but triggers early eruption check
                finalDmg *= 1.0;
                // Being hit accelerates accumulation — violence doesn't solve deferral cleanly
                this.accumulatedCost = Math.min(20, (this.accumulatedCost || 0) + amount * 0.1);
                
                // Pressure leak particles
                for (let i = 0; i < 2; i++) {
                    particles.push({
                        x: this.x, y: this.y,
                        vx: (Math.random() - 0.5) * 2,
                        vy: -0.8 - Math.random() * 0.5,
                        type: 'deferred_pressure',
                        timer: 0.3 + Math.random() * 0.2,
                        size: 1.5 + Math.random() * 1.5
                    });
                }
            }
        }
        
        if (this.type === 'remembered') {
            // The Remembered flinches like the PLAYER would — uncanny
            finalDmg *= 1.0;
            knockMult = 1.0;
            
            // Being hit increases its fidelity — it learns from your violence too
            this.mirrorFidelity = Math.min(0.95, (this.mirrorFidelity || 0.6) + 0.03);
            
            // Echo flinch — mirrors player damage response
            if (this.echoAttackTimer > 0 || this.echoDashTimer > 0) {
                // Caught mid-echo — the mirror shatters briefly
                finalDmg *= 1.3;
                this.echoAttackTimer = 0;
                this.echoDashTimer = 0;
                this.mimicState = 'observing';
                
                // Mirror crack particles
                for (let i = 0; i < 4; i++) {
                    particles.push({
                        x: this.x + (Math.random() - 0.5),
                        y: this.y - 0.5,
                        vx: (Math.random() - 0.5) * 3,
                        vy: (Math.random() - 0.5) * 3,
                        type: 'remembered_crack',
                        timer: 0.4 + Math.random() * 0.3,
                        size: 1.5 + Math.random() * 2
                    });
                }
            }
            
            // Low health — the echo panics, tries to dash away like the player would
            if (this.health - finalDmg < this.maxHealth * 0.3 && this.health >= this.maxHealth * 0.3) {
                this.echoDashTimer = 0.2;
                this.echoDashDir = { x: dx / dist, y: dy / dist }; // dash AWAY from damage
                this.mimicState = 'echo_dashing';
                this.uncanniness = Math.min(1, (this.uncanniness || 0) + 0.2);
            }
        }
        
        if (this.type === 'watchful') {
            if (this.state === 'overcommitted') {
                finalDmg *= 1.6;
                knockMult = 1.5;
                for (let i = 0; i < 4; i++) {
                    particles.push({
                        x: this.x, y: this.y,
                        vx: (dx / dist) * -2 + (Math.random() - 0.5) * 2,
                        vy: -1 - Math.random() * 2,
                        type: 'watchful_crumble',
                        timer: 0.8 + Math.random() * 0.5,
                        size: 2 + Math.random() * 3
                    });
                }
            } else if (this.state === 'burst_firing') {
                this.burstCount = 0;
                this.state = 'overcommitted';
                this.overcommitTimer = 1.5;
                for (let i = 0; i < 3; i++) {
                    particles.push({
                        x: this.x, y: this.y,
                        vx: (Math.random() - 0.5) * 4,
                        vy: (Math.random() - 0.5) * 4,
                        type: 'bolt_impact',
                        timer: 0.3 + Math.random() * 0.2,
                        size: 2 + Math.random() * 2
                    });
                }
            } else if (this.state === 'warning') {
                if (finalDmg > this.maxHealth * 0.15) {
                    this.state = 'watching';
                    this.warningTimer = 0;
                    this.setAttackCooldown(this.attackRate * 0.5);
                }
            } else {
                finalDmg *= 0.7;
                knockMult = 0.3;
            }
            
            this.vigilanceStacks = Math.min(5, this.vigilanceStacks + 0.5);
            
            if (this.health - finalDmg < this.maxHealth * 0.3 && this.health >= this.maxHealth * 0.3) {
                this.vigilanceStacks = 5;
                this.state = 'warning';
                this.warningTimer = 0.2;
                this.attackCooldown = 0;
            }
        }
        
        if (this.type === 'drifting') {
            if (this.state === 'lunging') {
                finalDmg *= 1.4;
                knockMult = 2.0;
                this.state = 'disengaging';
                this.disengageTimer = 1.2;
                this.dashTarget = null;
            } else if (this.state === 'disengaging') {
                finalDmg *= 0.6;
                knockMult = 0.5;
            } else if (this.state === 'orbiting') {
                finalDmg *= 0.8;
                knockMult = 0.7;
                this.orbitDir *= -1;
                this.orbitAngle += (Math.random() - 0.5) * 1.5;
                for (let i = 0; i < 3; i++) {
                    particles.push({
                        x: this.x, y: this.y,
                        vx: (Math.random() - 0.5) * 4,
                        vy: (Math.random() - 0.5) * 4,
                        type: 'drift_wisp',
                        timer: 0.5 + Math.random() * 0.3,
                        size: 3 + Math.random() * 2
                    });
                }
            }
            
            if (this.health - finalDmg < this.maxHealth * 0.35 && this.health >= this.maxHealth * 0.35) {
                this.speed *= 1.3;
                this.attackRate *= 0.6;
                this.damage += 3;
                for (let i = 0; i < 6; i++) {
                    particles.push({
                        x: this.x + (Math.random() - 0.5) * 2,
                        y: this.y + (Math.random() - 0.5) * 2,
                        vx: (Math.random() - 0.5) * 5,
                        vy: (Math.random() - 0.5) * 5,
                        type: 'drift_wisp',
                        timer: 0.6 + Math.random() * 0.4,
                        size: 2 + Math.random() * 4
                    });
                }
            }
        }
        
        // ── APPLY DAMAGE ──
        
        // Enemy grunt/shout on hit
        if (audioEngine && audioEngine.playEnemyHurt) {
            audioEngine.playEnemyHurt(this.type);
        }
        
        this.health -= finalDmg;
        this.knockbackX += (dx / dist) * 3 * knockMult;
        this.knockbackY += (dy / dist) * 3 * knockMult;
        
        // Blood / damage particles (type-colored)
        const bloodColors = {
            watchful: '#3a2a18',
            drifting: '#2a2826',
            lingering: '#352a25',
            huddled: '#2a2520',
            rehearsed: '#30281a',
            burdened: '#1e1816',
            deferred: '#282018',
            remembered: '#2c2826',
        };
        const bloodColor = bloodColors[this.type] || '#4a1a15';
        
        for (let i = 0; i < 5; i++) {
            particles.push({
                x: this.x, y: this.y,
                vx: (dx / dist) * -1 + (Math.random() - 0.5) * 3,
                vy: (Math.random() - 0.5) * 3,
                type: 'blood',
                timer: 0.5 + Math.random() * 0.5,
                size: 2 + Math.random() * 3,
                color: bloodColor
            });
        }
        
        // ── DEATH ──
        
        if (this.health <= 0) {
            this.dead = true;
            this.deathTimer = 0;
            player.burden = Math.max(0, player.burden - 2);
            
            // Grant insight from kill
            progression.grantInsight(this.type);
            
            // Spawn loot drops
            spawnEnemyDrops(this.type, this.x, this.y);
            
            // SFX — type-specific death tone
            if (audioEngine) audioEngine.playDeath(this.type);
            
            this.onDeath();
        }
    }
    
    onDeath() {
        // ── TYPE-SPECIFIC DEATH EVENTS ──
        
        if (this.type === 'lingering') {
            // The Lingering finally stops running. It doesn't explode or collapse — it just... stops.
            // A quiet, anticlimactic ending. All that avoidance, for this.
            camera.addShake(2);
            
            // Fading wisps — the avoidance dissipating
            const fadeCount = 6 + Math.floor((this.frustration || 0));
            for (let i = 0; i < fadeCount; i++) {
                const angle = (i / fadeCount) * Math.PI * 2 + Math.random() * 0.5;
                const speed = 0.3 + Math.random() * 1.2;
                particles.push({
                    x: this.x + (Math.random() - 0.5) * 0.5,
                    y: this.y + (Math.random() - 0.5) * 0.5,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed * 0.6 - 0.3,
                    type: 'linger_fade',
                    timer: 1.0 + Math.random() * 1.5,
                    size: 2 + Math.random() * 2
                });
            }
            
            // If frustration was high, residual outburst
            if ((this.frustration || 0) > 5) {
                for (let i = 0; i < 4; i++) {
                    particles.push({
                        x: this.x, y: this.y,
                        vx: (Math.random() - 0.5) * 3,
                        vy: (Math.random() - 0.5) * 2,
                        type: 'linger_panic',
                        timer: 0.4 + Math.random() * 0.3,
                        size: 2 + Math.random() * 2
                    });
                }
            }
            
            // Ground stain — it was here, avoiding
            particles.push({
                x: this.x, y: this.y,
                vx: 0, vy: 0,
                type: 'linger_stain',
                timer: 3.0,
                size: 8
            });
        }
        
        if (this.type === 'huddled') {
            // The Huddled dies reaching toward its group. 
            // Nearby Huddled enter grief-rage.
            camera.addShake(3);
            
            // Grief trigger in nearby allies
            const nearbyHuddled = enemies.filter(e => e !== this && e.type === 'huddled' && !e.dead &&
                Math.sqrt((e.x - this.x)**2 + (e.y - this.y)**2) < 6);
            for (const h of nearbyHuddled) {
                h.griefStacks = Math.min(5, (h.griefStacks || 0) + 2);
                h.griefTimer = 8;
            }
            
            // Reaching hand particles — fading extensions toward nearest ally
            const nearestAlly = enemies.find(e => e !== this && e.type === 'huddled' && !e.dead);
            if (nearestAlly) {
                const reachDx = nearestAlly.x - this.x;
                const reachDy = nearestAlly.y - this.y;
                const reachDist = Math.sqrt(reachDx * reachDx + reachDy * reachDy) || 1;
                for (let i = 0; i < 4; i++) {
                    particles.push({
                        x: this.x, y: this.y,
                        vx: (reachDx / reachDist) * (1 + Math.random()),
                        vy: (reachDy / reachDist) * (0.5 + Math.random()) - 0.3,
                        type: 'huddle_grief',
                        timer: 0.8 + Math.random() * 0.5,
                        size: 2 + Math.random() * 2
                    });
                }
            }
            
            // Collapse inward particles
            for (let i = 0; i < 5; i++) {
                particles.push({
                    x: this.x + (Math.random() - 0.5) * 0.5,
                    y: this.y + (Math.random() - 0.5) * 0.3,
                    vx: (Math.random() - 0.5) * 1.5,
                    vy: 0.3 + Math.random() * 0.5,
                    type: 'huddle_panic',
                    timer: 0.6 + Math.random() * 0.5,
                    size: 1.5 + Math.random() * 2
                });
            }
        }
        
        if (this.type === 'rehearsed') {
            // The Rehearsed's pattern finally breaks permanently.
            // The body freezes mid-motion — stuck in the last phase of its routine.
            camera.addShake(5);
            
            // Pattern fragment burst — the script scattering
            const fragCount = 10 + Math.floor((this.cycleCount || 0) * 2);
            for (let i = 0; i < fragCount; i++) {
                const angle = (i / fragCount) * Math.PI * 2 + Math.random() * 0.4;
                const speed = 1 + Math.random() * 3;
                particles.push({
                    x: this.x + (Math.random() - 0.5),
                    y: this.y + (Math.random() - 0.5) * 0.5,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed * 0.6,
                    type: 'rehearsed_fragment',
                    timer: 0.8 + Math.random() * 1.0,
                    size: 1.5 + Math.random() * 3
                });
            }
            
            // Final shatter ring
            particles.push({
                x: this.x, y: this.y,
                vx: 0, vy: 0,
                type: 'rehearsed_death_ring',
                timer: 1.0,
                size: 20
            });
            
            // Reward: precision recovery — the rigid pattern taught you something about timing
            psychStats.precision.value = Math.min(1, psychStats.precision.value + 0.04);
        }
        
        if (this.type === 'burdened') {
            // The Burdened finally sets its load down. The ground cracks.
            camera.addShake(10);
            
            // Massive impact — the weight finally hits the ground
            const impactCount = 12;
            for (let i = 0; i < impactCount; i++) {
                const angle = (i / impactCount) * Math.PI * 2;
                const speed = 2 + Math.random() * 3;
                particles.push({
                    x: this.x, y: this.y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed * 0.5 + 0.5,
                    type: 'burden_shed',
                    timer: 1.2 + Math.random() * 1.0,
                    size: 3 + Math.random() * 4
                });
            }
            
            // Ground impact crater
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                particles.push({
                    x: this.x, y: this.y,
                    vx: Math.cos(angle) * 1.5,
                    vy: Math.sin(angle) * 0.8,
                    type: 'burden_impact',
                    timer: 1.0 + Math.random() * 0.5,
                    size: 4 + Math.random() * 3
                });
            }
            
            // The shedding of the burden affects nearby — player gains burden tolerance
            psychStats.burden.value = Math.min(1, psychStats.burden.value + 0.06);
            
            // Gravity well lingers where it died — the weight persists
            if (this.gravityWells) {
                this.gravityWells.push({
                    x: this.x, y: this.y,
                    timer: 5, radius: 3
                });
            }
        }
        
        if (this.type === 'deferred') {
            // The Deferred finally gets resolved. Whether by eruption or by force.
            // The resolution is messy, not clean.
            camera.addShake(3 + (this.accumulatedCost || 0) * 0.3);
            
            // Stored cost scatters — everything it was holding erupts one last time
            const storedCost = this.accumulatedCost || 0;
            const burstCount = 5 + Math.floor(storedCost * 0.5);
            for (let i = 0; i < burstCount; i++) {
                const angle = (i / burstCount) * Math.PI * 2 + Math.random() * 0.5;
                const speed = 1 + Math.random() * (1.5 + storedCost * 0.1);
                particles.push({
                    x: this.x, y: this.y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed * 0.6 - 0.5,
                    type: 'deferred_eruption',
                    timer: 0.8 + Math.random() * 0.8,
                    size: 2 + Math.random() * 2
                });
            }
            
            // Relief particle — the pressure is finally gone
            particles.push({
                x: this.x, y: this.y,
                vx: 0, vy: -0.5,
                type: 'deferred_relief',
                timer: 2.0,
                size: 10
            });
            
            // Reward: integrity — you addressed something that was festering
            psychStats.integrity.value = Math.min(1, psychStats.integrity.value + 0.04);
        }
        
        if (this.type === 'remembered') {
            // The Remembered dies like the player might — trying to dodge, flinching, reaching.
            // Its death is unsettling because it feels personal.
            camera.addShake(4);
            
            // Echo fragments — pieces of the player's recorded actions scattering
            const echoCount = 8 + Math.floor((this.mirrorFidelity || 0.6) * 8);
            for (let i = 0; i < echoCount; i++) {
                const angle = (i / echoCount) * Math.PI * 2 + Math.random() * 0.3;
                const speed = 0.5 + Math.random() * 2;
                particles.push({
                    x: this.x + (Math.random() - 0.5) * 0.5,
                    y: this.y + (Math.random() - 0.5) * 0.5,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed * 0.6 - 0.3,
                    type: 'remembered_echo',
                    timer: 1.0 + Math.random() * 1.5,
                    size: 2 + Math.random() * 3
                });
            }
            
            // Mirror crack — the reflection shatters
            for (let i = 0; i < 5; i++) {
                particles.push({
                    x: this.x + (Math.random() - 0.5),
                    y: this.y - 0.5,
                    vx: (Math.random() - 0.5) * 3,
                    vy: -1 - Math.random() * 1.5,
                    type: 'remembered_crack',
                    timer: 0.8 + Math.random() * 0.6,
                    size: 2 + Math.random() * 3
                });
            }
            
            // Final shimmer — the memory fading
            particles.push({
                x: this.x, y: this.y,
                vx: 0, vy: -0.2,
                type: 'remembered_death_glow',
                timer: 2.5,
                size: 15
            });
            
            // Reward: agency — you destroyed something that was undermining your sense of self
            psychStats.agency.value = Math.min(1, psychStats.agency.value + 0.05);
        }
        
        if (this.type === 'watchful') {
            camera.addShake(4);
            
            const fragCount = 8 + Math.floor(this.vigilanceStacks * 3);
            for (let i = 0; i < fragCount; i++) {
                const angle = (i / fragCount) * Math.PI * 2 + Math.random() * 0.3;
                const speed = 2 + Math.random() * 3 + this.vigilanceStacks * 0.5;
                particles.push({
                    x: this.x, y: this.y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    type: 'watchful_death_shard',
                    timer: 0.8 + Math.random() * 0.6,
                    size: 1.5 + Math.random() * 2.5,
                    angle: angle
                });
            }
            
            particles.push({
                x: this.x, y: this.y,
                vx: 0, vy: 0,
                type: 'watchful_death_flash',
                timer: 1.2,
                size: 20
            });
            
            for (let i = 0; i < 6; i++) {
                particles.push({
                    x: this.x + (Math.random() - 0.5) * 1,
                    y: this.y + (Math.random() - 0.5) * 0.5,
                    vx: (Math.random() - 0.5) * 2,
                    vy: 0.5 + Math.random() * 1.5,
                    type: 'watchful_crumble',
                    timer: 1.5 + Math.random() * 1.0,
                    size: 3 + Math.random() * 4
                });
            }
            
            psychStats.awareness.value = Math.min(1, psychStats.awareness.value + 0.05);
        }
        
        if (this.type === 'drifting') {
            const wispCount = 12 + Math.floor(Math.random() * 6);
            for (let i = 0; i < wispCount; i++) {
                const angle = (i / wispCount) * Math.PI * 2 + Math.random() * 0.5;
                const speed = 0.8 + Math.random() * 2;
                particles.push({
                    x: this.x + (Math.random() - 0.5) * 0.5,
                    y: this.y + (Math.random() - 0.5) * 0.5,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed * 0.7 - 0.5,
                    type: 'drift_death_mote',
                    timer: 1.5 + Math.random() * 2.0,
                    size: 2 + Math.random() * 3,
                    driftPhase: Math.random() * Math.PI * 2
                });
            }
            
            particles.push({
                x: this.x, y: this.y,
                vx: 0, vy: -0.3,
                type: 'drift_death_core',
                timer: 2.5,
                size: 8
            });
            
            particles.push({
                x: this.x, y: this.y,
                vx: 0, vy: 0,
                type: 'drift_death_stain',
                timer: 4.0,
                size: 12
            });
            
            psychStats.adaptability.value = Math.min(1, psychStats.adaptability.value + 0.06);
        }
    }
}

function spawnEnemies() {
    enemies = [];
    const hubX = WORLD_SIZE / 2;
    const hubY = WORLD_SIZE / 2;
    
    // Helper: ensure spawns are outside hub
    const minSpawnDist = HUB_SAFE_RADIUS + 2;
    function safeSpawn(type, x, y) {
        const d = Math.sqrt((x - hubX) ** 2 + (y - hubY) ** 2);
        if (d < minSpawnDist) {
            const a = Math.atan2(y - hubY, x - hubX);
            x = hubX + Math.cos(a) * minSpawnDist;
            y = hubY + Math.sin(a) * minSpawnDist;
        }
        enemies.push(new Enemy(type, x, y));
    }
    
    // The Lingering — scattered across the verge
    for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = minSpawnDist + Math.random() * 12;
        safeSpawn('lingering', hubX + Math.cos(angle) * dist, hubY + Math.sin(angle) * dist);
    }
    
    // The Watchful — along fence lines and structures
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const dist = minSpawnDist + 2 + Math.random() * 5;
        safeSpawn('watchful', hubX + Math.cos(angle) * dist, hubY + Math.sin(angle) * dist);
    }
    
    // The Huddled — in groups
    for (let g = 0; g < 3; g++) {
        const gAngle = Math.random() * Math.PI * 2;
        const gDist = minSpawnDist + 4 + Math.random() * 10;
        const gx = hubX + Math.cos(gAngle) * gDist;
        const gy = hubY + Math.sin(gAngle) * gDist;
        for (let i = 0; i < 4; i++) {
            safeSpawn('huddled', gx + (Math.random() - 0.5) * 2, gy + (Math.random() - 0.5) * 2);
        }
    }
    
    // The Deferred — hidden in environment
    for (let i = 0; i < 6; i++) {
        const dAngle = Math.random() * Math.PI * 2;
        const dDist = minSpawnDist + 3 + Math.random() * 15;
        safeSpawn('deferred', hubX + Math.cos(dAngle) * dDist, hubY + Math.sin(dAngle) * dDist);
    }
    
    // The Rehearsed — patrol paths
    for (let i = 0; i < 4; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 15 + Math.random() * 10;
        enemies.push(new Enemy('rehearsed', hubX + Math.cos(angle) * dist, hubY + Math.sin(angle) * dist));
    }
    
    // The Burdened — rare, heavy
    for (let i = 0; i < 2; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 18 + Math.random() * 8;
        enemies.push(new Enemy('burdened', hubX + Math.cos(angle) * dist, hubY + Math.sin(angle) * dist));
    }
    
    // The Drifting — harassment
    for (let i = 0; i < 5; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 8 + Math.random() * 18;
        enemies.push(new Enemy('drifting', hubX + Math.cos(angle) * dist, hubY + Math.sin(angle) * dist));
    }
    
    // The Remembered — rare
    enemies.push(new Enemy('remembered', hubX + 20, hubY - 15));
    enemies = enemies.filter(e => {
        if (!isBlockedAt(e.x,e.y) && Math.hypot(e.x-hubX,e.y-hubY)>=minSpawnDist) return true;
        const origin={x:e.x,y:e.y};
        for (let r=0.5; r<=8; r+=0.5) {
            for (let i=0; i<16; i++) {
                const x=origin.x+Math.cos(i*Math.PI/8)*r;
                const y=origin.y+Math.sin(i*Math.PI/8)*r;
                if (x<1 || y<1 || x>WORLD_SIZE-1 || y>WORLD_SIZE-1) continue;
                if (Math.hypot(x-hubX,y-hubY)<minSpawnDist || isBlockedAt(x,y)) continue;
                e.x=x; e.y=y; return true;
            }
        }
        return false;
    });
}

// ============================================================
// PARTICLES
// ============================================================
function updateParticles(dt) {
    particles = particles.filter(p => {
        p.timer -= dt;
        p.x += (p.vx || 0) * dt;
        p.y += (p.vy || 0) * dt;
        
        // Legacy generic projectile
        if (p.type === 'projectile') {
            const dx = player.x - p.x;
            const dy = player.y - p.y;
            if (Math.sqrt(dx * dx + dy * dy) < 0.5) {
                player.takeDamage(p.damage);
                p.timer = 0;
            }
        }

        // Player bullet — hits enemies
        if (p.type === 'player_bullet') {
            for (const enemy of adaptiveArray(enemies)) {
                if (!enemy || enemy.dead) continue;
                const dx = enemy.x - p.x;
                const dy = enemy.y - p.y;
                const hitR = (p.hitRadius || 0.55) + (enemy.radius || 0.6);
                if (dx*dx + dy*dy < hitR*hitR) {
                    enemy.takeDamage(p.damage || 8, player.x, player.y);
                    // Small impact burst
                    for (let i = 0; i < 3; i++) {
                        particles.push({
                            x: p.x, y: p.y,
                            vx: (Math.random() - 0.5) * 4,
                            vy: (Math.random() - 0.5) * 4,
                            type: 'spark',
                            timer: 0.18 + Math.random() * 0.12,
                            size: 1.5 + Math.random() * 1.5
                        });
                    }
                    if (audioEngine) audioEngine.playGunHit(p.crit ? 1 : 0);
                    if (p.pierce && p.pierce > 0) {
                        p.pierce -= 1;
                        p.damage *= 0.72;
                    } else {
                        p.timer = 0;
                    }
                    break;
                }
            }
        }

        
        // Watchful bolt — proper hitbox with configurable radius
        if (p.type === 'watchful_bolt') {
            const dx = player.x - p.x;
            const dy = player.y - p.y;
            const hitDist = Math.sqrt(dx * dx + dy * dy);
            const hitRadius = p.hitRadius || 0.6;
            
            if (hitDist < hitRadius) {
                // Player can dodge if dashing (invulnerable)
                if (player.invulnTimer <= 0) {
                    player.takeDamage(p.damage);
                    camera.addShake(3);
                    
                    // Impact burst particles
                    for (let i = 0; i < 3; i++) {
                        particles.push({
                            x: p.x, y: p.y,
                            vx: (Math.random() - 0.5) * 3,
                            vy: (Math.random() - 0.5) * 3,
                            type: 'bolt_impact',
                            timer: 0.3 + Math.random() * 0.2,
                            size: 2 + Math.random() * 2
                        });
                    }
                }
                p.timer = 0;
            }
            
            // Bolts leave faint trail
            if (Math.random() < 0.3) {
                particles.push({
                    x: p.x, y: p.y,
                    vx: 0, vy: 0,
                    type: 'bolt_trail',
                    timer: 0.2 + Math.random() * 0.15,
                    size: 1.5
                });
            }
        }
        
        if (p.type === 'blood') {
            p.vx *= 0.95;
            p.vy *= 0.95;
        }
        
        // Drift wisps decelerate and fade
        if (p.type === 'drift_wisp') {
            p.vx *= 0.92;
            p.vy *= 0.92;
            p.size = (p.size || 3) * 0.98;
        }
        
        // Bolt trail is static, just fades
        // Bolt impact sparks decelerate
        if (p.type === 'bolt_impact') {
            p.vx *= 0.88;
            p.vy *= 0.88;
        }
        
        // Watchful crumble — falls with gravity
        if (p.type === 'watchful_crumble') {
            p.vy += 3 * dt; // gravity
            p.vx *= 0.96;
        }
        
        // Watchful death shards — radial burst, decelerating
        if (p.type === 'watchful_death_shard') {
            p.vx *= 0.94;
            p.vy *= 0.94;
            p.size = (p.size || 2) * 0.995;
        }
        
        // Watchful death flash — static, just fades and shrinks
        if (p.type === 'watchful_death_flash') {
            p.size = (p.size || 20) * 0.97;
        }
        
        // Drift death mote — wandering, weightless
        if (p.type === 'drift_death_mote') {
            p.driftPhase = (p.driftPhase || 0) + dt * 2;
            p.vx += Math.sin(p.driftPhase) * 0.3 * dt;
            p.vy -= 0.2 * dt; // slow upward drift
            p.vx *= 0.98;
            p.vy *= 0.98;
            p.size = (p.size || 3) * 0.997;
        }
        
        // Drift death core — slow ascent, shrinking
        if (p.type === 'drift_death_core') {
            p.vy -= 0.1 * dt;
            p.size = (p.size || 8) * 0.993;
        }
        
        // Drift death stain — static ground mark, just fades
        // (no movement needed)
        
        // ── NEW SKILL PARTICLE PHYSICS ──
        
        // Dash trail — quick fade, slight gravity
        if (p.type === 'dash_trail') {
            p.vx *= 0.9;
            p.vy *= 0.9;
            p.size = (p.size || 3) * 0.96;
        }
        
        // Shadow trail — darker, lingers, drifts upward
        if (p.type === 'shadow_trail') {
            p.vx *= 0.92;
            p.vy -= 0.5 * dt;
            p.size = (p.size || 3) * 0.97;
        }
        
        // Shadow emerge — erupts then disperses
        if (p.type === 'shadow_emerge') {
            p.vx *= 0.93;
            p.vy *= 0.93;
            p.vy -= 0.3 * dt;
            p.size = (p.size || 4) * 0.97;
        }
        
        // Shadow fizzle — spark that dies
        if (p.type === 'shadow_fizzle') {
            p.size = (p.size || 10) * 0.94;
        }
        
        // Reclamation crack — crawls outward then stops
        if (p.type === 'reclaim_crack') {
            p.vx *= 0.92;
            p.vy *= 0.92;
        }
        
        // Reclamation spore — slow rise, organic
        if (p.type === 'reclaim_spore') {
            p.vy -= 0.15 * dt;
            p.vx += Math.sin(TIME.elapsed * 3 + (p.angle || 0)) * 0.2 * dt;
            p.size = (p.size || 2) * 0.995;
        }
        
        // Attunement pulse — static expanding ring
        if (p.type === 'attune_pulse') {
            p.size = (p.size || 25) + dt * 8;
        }
        
        // Burden wave — radial burst, decelerating
        if (p.type === 'burden_wave') {
            p.vx *= 0.92;
            p.vy *= 0.92;
            p.size = (p.size || 3) * 0.97;
        }
        
        // Snare deploy — static flash
        if (p.type === 'snare_deploy') {
            p.size = (p.size || 15) * 0.96;
        }
        
        // Crit flash — brief bright burst
        if (p.type === 'crit_flash') {
            p.size = (p.size || 8) * 0.92;
        }
        
        // ── LINGERING PARTICLES ──
        
        // Linger panic — erratic, jittery, dying frustration
        if (p.type === 'linger_panic') {
            p.vx += (Math.random() - 0.5) * 8 * dt;
            p.vy += (Math.random() - 0.5) * 6 * dt;
            p.vx *= 0.9;
            p.vy *= 0.9;
            p.size = (p.size || 2) * 0.97;
        }
        
        // Linger fade — slow, reluctant dispersal
        if (p.type === 'linger_fade') {
            p.vx *= 0.94;
            p.vy *= 0.94;
            p.vy -= 0.3 * dt; // slight upward drift
            p.size = (p.size || 2) * 0.99;
        }
        
        // Linger stain — static ground mark, only fades
        // (no movement)
        
        // ── HUDDLED PARTICLES ──
        
        // Huddle grief — reaching tendrils toward allies
        if (p.type === 'huddle_grief') {
            p.vx *= 0.93;
            p.vy *= 0.93;
            p.vy -= 0.15 * dt;
            p.size = (p.size || 2) * 0.98;
        }
        
        // Huddle panic — scattering inward collapse
        if (p.type === 'huddle_panic') {
            p.vx *= 0.88;
            p.vy *= 0.88;
            p.vy += 0.5 * dt; // gravity pulls down
            p.size = (p.size || 2) * 0.96;
        }
        
        // ── REHEARSED PARTICLES ──
        
        // Rehearsed shatter — angular debris from disrupted pattern
        if (p.type === 'rehearsed_shatter') {
            p.vx *= 0.9;
            p.vy *= 0.9;
            p.size = (p.size || 2) * 0.97;
        }
        
        // Rehearsed fragment — pieces of the script scattering
        if (p.type === 'rehearsed_fragment') {
            p.vx *= 0.93;
            p.vy *= 0.93;
            p.vy += 0.8 * dt; // gravity — fragments fall
            p.size = (p.size || 2) * 0.995;
        }
        
        // Rehearsed step — metronomic footfall dust
        if (p.type === 'rehearsed_step') {
            p.vx *= 0.85;
            p.vy *= 0.85;
            p.size = (p.size || 2) * 0.94;
        }
        
        // Rehearsed death ring — expanding ring, static position
        if (p.type === 'rehearsed_death_ring') {
            p.size = (p.size || 20) + dt * 30;
        }
        
        // ── BURDENED PARTICLES ──
        
        // Burden shed — heavy chunks flying outward
        if (p.type === 'burden_shed') {
            p.vx *= 0.92;
            p.vy *= 0.92;
            p.vy += 1.5 * dt; // heavy — gravity pulls hard
            p.size = (p.size || 3) * 0.997;
        }
        
        // Burden crumble — smaller debris chipping off
        if (p.type === 'burden_crumble') {
            p.vx *= 0.9;
            p.vy += 2 * dt; // gravity
            p.size = (p.size || 2) * 0.96;
        }
        
        // Burden impact — ground crack radiating outward
        if (p.type === 'burden_impact') {
            p.vx *= 0.88;
            p.vy *= 0.88;
        }
        
        // Burden trail — heavy dragging marks
        if (p.type === 'burden_trail') {
            p.vx *= 0.85;
            p.vy *= 0.85;
            p.size = (p.size || 2) * 0.95;
        }
        
        // Burden step — ground impact puffs
        if (p.type === 'burden_step') {
            p.vx *= 0.88;
            p.vy *= 0.88;
            p.vy -= 0.2 * dt;
            p.size = (p.size || 2) * 0.94;
        }
        
        // ── DEFERRED PARTICLES ──
        
        // Deferred pressure — internal tension leaking
        if (p.type === 'deferred_pressure') {
            p.vx *= 0.92;
            p.vy *= 0.92;
            p.vy -= 0.4 * dt; // rises
            p.size = (p.size || 2) * 0.97;
        }
        
        // Deferred unfurl — opening/unfolding wisps
        if (p.type === 'deferred_unfurl') {
            p.vx *= 0.94;
            p.vy *= 0.94;
            p.size = (p.size || 3) * 0.98;
        }
        
        // Deferred eruption — violent burst of stored cost
        if (p.type === 'deferred_eruption') {
            p.vx *= 0.91;
            p.vy *= 0.91;
            p.vy -= 0.5 * dt;
            p.size = (p.size || 2) * 0.97;
        }
        
        // Deferred pulse — expanding damage ring
        if (p.type === 'deferred_pulse') {
            p.size = (p.size || 15) + dt * 40;
        }
        
        // Deferred relief — ascending calm after resolution
        if (p.type === 'deferred_relief') {
            p.vy -= 0.1 * dt;
            p.size = (p.size || 10) * 0.997;
        }
        
        // ── REMEMBERED PARTICLES ──
        
        // Remembered echo — dark afterimage fragments
        if (p.type === 'remembered_echo') {
            p.vx *= 0.93;
            p.vy *= 0.93;
            p.vy -= 0.2 * dt;
            p.size = (p.size || 2) * 0.98;
        }
        
        // Remembered strike — attack echo sparks
        if (p.type === 'remembered_strike') {
            p.vx *= 0.88;
            p.vy *= 0.88;
            p.size = (p.size || 2) * 0.95;
        }
        
        // Remembered shimmer — uncanny presence glow
        if (p.type === 'remembered_shimmer') {
            p.vy -= 0.1 * dt;
            p.vx += Math.sin(TIME.elapsed * 4 + (p.size || 0)) * 0.2 * dt;
            p.size = (p.size || 2) * 0.995;
        }
        
        // Remembered crack — mirror shattering
        if (p.type === 'remembered_crack') {
            p.vx *= 0.9;
            p.vy *= 0.9;
            p.vy -= 0.3 * dt;
            p.size = (p.size || 2) * 0.97;
        }
        
        // Remembered death glow — fading memorial light
        if (p.type === 'remembered_death_glow') {
            p.vy -= 0.05 * dt;
            p.size = (p.size || 15) * 0.995;
        }
        
        // Campfire ember — floating spark
        if (p.type === 'campfire_ember') {
            p.vx += (Math.random() - 0.5) * 2 * dt;
            p.vy -= 0.3 * dt;
            p.vx *= 0.95;
            p.size = (p.size || 1.5) * 0.97;
        }
        
        // ── ENHANCED SKILL PARTICLE PHYSICS ──
        
        // Dash dust — ground puff expanding and fading
        if (p.type === 'dash_dust') {
            p.vx *= 0.88;
            p.vy *= 0.88;
            p.size = (p.size || 3) * 0.95;
        }
        
        // Dash streak — fast, quickly fading motion line
        if (p.type === 'dash_streak') {
            p.vx *= 0.85;
            p.vy *= 0.85;
        }
        
        // Snare rune — orbital fragments decelerating
        if (p.type === 'snare_rune') {
            p.vx *= 0.9;
            p.vy *= 0.9;
            p.size = (p.size || 2) * 0.97;
        }
        
        // Snare inscription — static ground mark
        if (p.type === 'snare_inscription') {
            // stays in place, just fades
        }
        
        // Reclamation pulse — expanding ring
        if (p.type === 'reclaim_pulse') {
            p.size = (p.size || 8) + dt * 35;
        }
        
        // Reclamation tendril — slow creeping growth
        if (p.type === 'reclaim_tendril') {
            p.vx *= 0.97;
            p.vy *= 0.97;
        }
        
        // Attune mote — orbiting awareness spark
        if (p.type === 'attune_mote') {
            p.angle = (p.angle || 0) + dt * 1.5;
            p.vy *= 0.98;
            p.size = (p.size || 1.5) * 0.998;
        }
        
        // Attune glyph — static ground circle
        if (p.type === 'attune_glyph') {
            // stationary
        }
        
        // Attune bloom — expanding light burst
        if (p.type === 'attune_bloom') {
            p.size = (p.size || 35) * 0.96;
        }
        
        // Burden shockwave — expanding ring
        if (p.type === 'burden_shockwave') {
            p.size = (p.size || 10) + dt * 60;
        }
        
        // Burden shard — violent eruption debris
        if (p.type === 'burden_shard') {
            p.vx *= 0.92;
            p.vy *= 0.92;
            p.vy += 2 * dt; // gravity
            p.size = (p.size || 2) * 0.97;
        }
        
        // Burden absorb — inward spiral
        if (p.type === 'burden_absorb') {
            p.vx *= 0.92;
            p.vy *= 0.92;
            p.size = (p.size || 2) * 0.96;
        }
        
        // Burden vapor — rising cost smoke
        if (p.type === 'burden_vapor') {
            p.vx *= 0.95;
            p.vy *= 0.97;
            p.size = (p.size || 4) * 0.99;
        }
        
        // Shadow tendril — creeping dark arm
        if (p.type === 'shadow_tendril') {
            p.vx *= 0.96;
            p.vy *= 0.96;
            p.vx += Math.sin(TIME.elapsed * 3 + (p.angle || 0)) * 0.3 * dt;
        }
        
        // Shadow corruption — expanding dark ground stain
        if (p.type === 'shadow_corruption') {
            // stationary, pulses
        }
        
        // Shadow vortex — swirling inward spiral
        if (p.type === 'shadow_vortex') {
            const a = p.angle || 0;
            p.vx = -Math.sin(a + TIME.elapsed * 3) * 1.5;
            p.vy = Math.cos(a + TIME.elapsed * 3) * 0.8 - 0.3;
            p.angle = a + dt * 2;
            p.size = (p.size || 2) * 0.995;
        }
        
        // Shadow flash — initial burst
        if (p.type === 'shadow_flash') {
            p.size = (p.size || 40) * 0.93;
        }
        
        return p.timer > 0;
    });
}

// ============================================================
// RENDERING
// ============================================================
const TIME = { elapsed: 0, percept: 0 };
let gameTime = 0; // used for jitter/noise phase
// track last frame timestamp to detect slow render and skip expensive effects
let lastFrameTime = 0;

// globally available adaptive throttling for arrays
function adaptiveArray(arr) {
    if (typeof window !== 'undefined' && window.frameLag > 24 && arr && arr.length > 20) {
        const q = window.perfQuality || 1;
        return arr.slice(0, Math.max(1, Math.ceil(arr.length * q)));
    }
    return arr;
}

// globally available throttling helper (used by renderAtmosphericFog and others)
function throttleArray(arr) {
    if (typeof window !== 'undefined' && window.frameLag > 24 && arr && arr.length > 20) {
        const q = window.perfQuality || 1;
        return arr.slice(0, Math.max(1, Math.ceil(arr.length * q)));
    }
    return arr;
}

// support for hysteresis when deciding whether to skip tile rows
// we keep skipping extremely rare to avoid visual glitches; only when perfQuality plunges
let tileStep = 1;
let _lastPerfQuality = 1;
function updateTileStep(perfQuality) {
    // only skip if perfQuality is disastrous
    if (tileStep === 1 && perfQuality < 0.2) {
        tileStep = 2;
    } else if (tileStep === 2 && perfQuality > 0.4) {
        tileStep = 1;
    }
    _lastPerfQuality = perfQuality;
}

function render() {
    const W = canvas.width;
    const H = canvas.height;
    // timing for performance-sensitive effects
    const nowPerf = performance.now();
    const frameLag = nowPerf - lastFrameTime;
    lastFrameTime = nowPerf;
    // quality scalar (1 = full quality, 0.3 = very low); used for adaptive throttling
    const perfQuality = Math.max(0.3, Math.min(1, 1 - (frameLag - 16) / 200));
    // expose for other systems
    window.frameLag = frameLag;
    window.perfQuality = perfQuality;

    // update our tile-step threshold (hysteresis prevents flicker)
    updateTileStep(perfQuality);
    
    ctx.fillStyle = '#0a0908';
    ctx.fillRect(0, 0, W, H);
    
    // Apply camera zoom and colour grading
    // no blur/zoom any more; CSS filters handle saturation/contrast effects
    const baseSat = greyline.knobs?.vfx?.saturation ?? 1.0;
    const over = greyline.knobs?.vfx?.overdrive ?? 1.0;
    const finalSat = baseSat * over;
    const finalContrast = greyline.knobs?.vfx?.contrast ?? 1.0;
    canvas.style.filter = `saturate(${finalSat}) contrast(${finalContrast})`;
    // ensure no per-draw filter is set
    ctx.filter = 'none';
    ctx.save();
    // always use base camera zoom
    ctx.scale(camera.zoom, camera.zoom);
    
    const cam = camera.getOffset();
    
    // Render world tiles
    renderTerrain(cam);
    
    // Collect all renderables and sort by Y for depth
    const renderables = [];
    
    // Structures
    for (const s of world.structures) {
        const anchor = structureAnchor(s);
        const pos = worldToScreen(anchor.x, anchor.y);
        renderables.push({ type: 'structure', data: s, y: pos.y, pos });
    }
    
    // Fence posts
    for (const f of world.fencePosts) {
        const pos = worldToScreen(f.x, f.y);
        renderables.push({ type: 'fence', data: f, y: pos.y, pos });
    }
    
    // Trees
    for (const t of world.trees) {
        const pos = worldToScreen(t.x, t.y);
        renderables.push({ type: 'tree', data: t, y: pos.y, pos });
    }
    
    // Environmental props (dead trees, ruins, barns, rocks, fences)
    for (const p of world.props) {
        const pos = worldToScreen(p.x, p.y);
        // Ground rocks sort slightly before; tall props sort at base
        renderables.push({ type: 'prop', data: p, y: pos.y, pos });
    }
    
    // Reclamation zones (render below everything else in this Y band)
    for (const z of player.reclaimZones) {
        const pos = worldToScreen(z.x, z.y);
        renderables.push({ type: 'reclaim_zone', data: z, y: pos.y - 1, pos });
    }
    
    // Snares
    for (const s of player.snarePlaced) {
        const pos = worldToScreen(s.x, s.y);
        renderables.push({ type: 'snare', data: s, y: pos.y, pos });
    }
    
    // Wall segments
    for (const w of world.wallSegments) {
        const pos = worldToScreen(w.x, w.y);
        renderables.push({ type: 'wall', data: w, y: pos.y, pos });
    }
    
    // Gate pillars
    if (world.gatePos) {
        const gPos = worldToScreen(world.gatePos.x, world.gatePos.y);
        renderables.push({ type: 'gate', data: world.gatePos, y: gPos.y, pos: gPos });
    }
    
    // NPCs
    for (const npc of world.npcs) {
        const pos = worldToScreen(npc.x, npc.y);
        renderables.push({ type: 'npc', data: npc, y: pos.y, pos });
    }
    
    // Campfire
    if (world.campfire) {
        const cfPos = worldToScreen(world.campfire.x, world.campfire.y);
        renderables.push({ type: 'campfire', y: cfPos.y, pos: cfPos });
    }
    
    // World drops (gold, health, items on the ground)
    for (const drop of worldDrops) {
        if (drop.collected) continue;
        const pos = worldToScreen(drop.x, drop.y);
        renderables.push({ type: 'world_drop', data: drop, y: pos.y, pos });
    }
    
    // Player
    let playerPos = worldToScreen(player.x, player.y);
    // jitter the player sprite slightly under compulsion
    try {
        if (greyline.getSide() === 'compulsion') {
            const comp = greyline.getExtremity();
            const j = comp * 2;
            playerPos.x += (Math.random()*2-1) * j;
            playerPos.y += (Math.random()*2-1) * j;
        }
    } catch(e) {}
    renderables.push({ type: 'player', y: playerPos.y, pos: playerPos });
    
    // Enemies
    for (const e of enemies) {
        const maxDeathTime = 3.5;
        if (e.dead && e.deathTimer > maxDeathTime) continue;
        const pos = worldToScreen(e.x, e.y);
        renderables.push({ type: 'enemy', data: e, y: pos.y, pos });
    }
    
    // Sort by depth
    renderables.sort((a, b) => a.y - b.y);
    
    // Draw all
    for (const r of renderables) {
        ctx.save();
        const sx = r.pos.x + cam.x;
        const sy = r.pos.y + cam.y;
        
        switch (r.type) {
            case 'structure': drawStructure(ctx, sx, sy, r.data); break;
            case 'fence': drawFence(ctx, sx, sy, r.data); break;
            case 'tree': drawTree(ctx, sx, sy, r.data); break;
            case 'prop': drawProp(ctx, sx, sy, r.data); break;
            case 'wall': drawWall(ctx, sx, sy, r.data); break;
            case 'gate': drawGate(ctx, sx, sy, r.data); break;
            case 'npc': drawNPC(ctx, sx, sy, r.data); break;
            case 'reclaim_zone': drawReclaimZone(ctx, sx, sy, r.data); break;
            case 'snare': drawSnare(ctx, sx, sy, r.data); break;
            case 'campfire': drawCampfire(ctx, sx, sy); break;
            case 'world_drop': drawWorldDrop(ctx, sx, sy, r.data); break;
            case 'player': drawPlayer(ctx, sx, sy); break;
            case 'enemy': drawEnemy(ctx, sx, sy, r.data, cam); break;
        }
        
        ctx.restore();
    }
    
    // Particles
    for (const p of particles) {
        const pos = worldToScreen(p.x, p.y);
        const sx = pos.x + cam.x;
        const sy = pos.y + cam.y;
        
        if (p.type === 'blood') {
            ctx.globalAlpha = p.timer;
            ctx.fillStyle = p.color || '#4a1a15';
            ctx.beginPath();
            ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        if (p.type === 'projectile') {
            ctx.fillStyle = '#8a6a55';
            ctx.shadowColor = '#6a4a35';
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(sx, sy, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
        
        // Player bullet — colder, more "real" snap
        if (p.type === 'player_bullet') {
            const angle = Math.atan2(p.vy || 0, p.vx || 0);
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(angle);
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = p.crit ? 'rgba(220,220,235,0.95)' : 'rgba(200,200,215,0.9)';
            ctx.shadowColor = 'rgba(140,140,160,0.65)';
            ctx.shadowBlur = 10;
            ctx.fillRect(-2, -1, 6, 2);
            ctx.globalAlpha = 0.25;
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(200,200,220,0.35)';
            ctx.fillRect(-10, -1, 10, 2);
            ctx.restore();
        }
        
        if (p.type === 'spark') {
            ctx.globalAlpha = Math.min(1, p.timer * 5);
            ctx.fillStyle = 'rgba(180,180,200,0.8)';
            ctx.beginPath();
            ctx.arc(sx, sy, p.size || 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // Watchful bolt — harsh amber streak
        if (p.type === 'watchful_bolt') {
            const speed = Math.sqrt((p.vx || 0) ** 2 + (p.vy || 0) ** 2);
            const angle = Math.atan2(p.vy || 0, p.vx || 0);
            
            // Core
            ctx.fillStyle = '#c09050';
            ctx.shadowColor = '#a07030';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(sx, sy, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            
            // Directional trail streak
            ctx.strokeStyle = 'rgba(160,120,70,0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx - Math.cos(angle) * 10, sy - Math.sin(angle) * 10);
            ctx.stroke();
            
            // Outer glow
            ctx.globalAlpha = 0.2;
            ctx.fillStyle = '#a08040';
            ctx.beginPath();
            ctx.arc(sx, sy, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // Bolt trail — fading ember dots
        if (p.type === 'bolt_trail') {
            ctx.globalAlpha = p.timer * 3;
            ctx.fillStyle = '#8a6a40';
            ctx.beginPath();
            ctx.arc(sx, sy, p.size || 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // Bolt impact — bright spark
        if (p.type === 'bolt_impact') {
            ctx.globalAlpha = Math.min(1, p.timer * 4);
            ctx.fillStyle = '#d0a060';
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 2) * (p.timer * 3), 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // Drift wisp — translucent, unsettling
        if (p.type === 'drift_wisp') {
            ctx.globalAlpha = Math.min(0.5, p.timer * 0.8);
            ctx.fillStyle = '#4a4540';
            ctx.beginPath();
            ctx.arc(sx, sy, p.size || 3, 0, Math.PI * 2);
            ctx.fill();
            // Inner lighter core
            ctx.fillStyle = 'rgba(80,75,65,0.3)';
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 3) * 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // ── WATCHFUL DEATH PARTICLES ──
        
        // Crumble chunks — dark stone falling
        if (p.type === 'watchful_crumble') {
            ctx.globalAlpha = Math.min(1, p.timer * 1.5);
            ctx.fillStyle = '#2a2218';
            const s = p.size || 3;
            // Irregular shape — rotated rectangle
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(p.timer * 3 + (p.size || 0));
            ctx.fillRect(-s / 2, -s / 2, s, s * 0.7);
            ctx.restore();
            ctx.globalAlpha = 1;
        }
        
        // Death shards — amber energy fragments radiating outward
        if (p.type === 'watchful_death_shard') {
            const t = Math.min(1, p.timer * 1.2);
            ctx.globalAlpha = t * 0.8;
            const s = p.size || 2;
            const angle = p.angle || 0;
            
            // Elongated shard along movement direction
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(angle);
            
            // Core — bright amber
            ctx.fillStyle = `rgba(200,160,80,${t})`;
            ctx.fillRect(-s * 1.5, -s * 0.3, s * 3, s * 0.6);
            
            // Glow halo
            ctx.fillStyle = `rgba(160,120,50,${t * 0.3})`;
            ctx.beginPath();
            ctx.ellipse(0, 0, s * 2, s, 0, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
            ctx.globalAlpha = 1;
        }
        
        // Death flash — expanding/fading central light
        if (p.type === 'watchful_death_flash') {
            const t = p.timer / 1.2; // normalized 1→0
            const s = p.size || 20;
            
            // Outer ring
            ctx.globalAlpha = t * 0.4;
            ctx.strokeStyle = '#c0a050';
            ctx.lineWidth = 1.5 * t;
            ctx.beginPath();
            ctx.arc(sx, sy - 25, s * (1.3 - t * 0.3), 0, Math.PI * 2);
            ctx.stroke();
            
            // Inner glow
            const grad = ctx.createRadialGradient(sx, sy - 25, 0, sx, sy - 25, s * t);
            grad.addColorStop(0, `rgba(200,170,90,${t * 0.5})`);
            grad.addColorStop(0.5, `rgba(140,110,50,${t * 0.2})`);
            grad.addColorStop(1, 'rgba(100,80,40,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(sx, sy - 25, s * t, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.globalAlpha = 1;
        }
        
        // ── DRIFTING DEATH PARTICLES ──
        
        // Death motes — wandering translucent dots, the body coming apart
        if (p.type === 'drift_death_mote') {
            const t = p.timer / 3.5; // normalized
            const s = p.size || 3;
            
            ctx.globalAlpha = Math.min(0.6, t * 0.8);
            
            // Outer haze
            ctx.fillStyle = `rgba(60,55,48,${t * 0.3})`;
            ctx.beginPath();
            ctx.arc(sx, sy, s * 1.5, 0, Math.PI * 2);
            ctx.fill();
            
            // Core
            ctx.fillStyle = `rgba(80,72,60,${t * 0.6})`;
            ctx.beginPath();
            ctx.arc(sx, sy, s * 0.7, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.globalAlpha = 1;
        }
        
        // Death core — the last coherent remnant, ascending
        if (p.type === 'drift_death_core') {
            const t = p.timer / 2.5;
            const s = p.size || 8;
            
            // Pulsing, translucent mass
            const pulse = Math.sin(TIME.elapsed * 3 + (p.driftPhase || 0)) * 0.15;
            ctx.globalAlpha = t * 0.45;
            
            // Outer shimmer
            ctx.fillStyle = `rgba(55,50,42,${t * 0.25})`;
            ctx.beginPath();
            ctx.arc(sx, sy, s * (1.2 + pulse), 0, Math.PI * 2);
            ctx.fill();
            
            // Mid layer
            ctx.fillStyle = `rgba(70,63,52,${t * 0.4})`;
            ctx.beginPath();
            ctx.arc(sx, sy, s * (0.7 + pulse * 0.5), 0, Math.PI * 2);
            ctx.fill();
            
            // Bright inner point — the last spark
            ctx.fillStyle = `rgba(100,90,70,${t * 0.6})`;
            ctx.beginPath();
            ctx.arc(sx, sy, s * 0.2, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.globalAlpha = 1;
        }
        
        // Ground stain — where the Drifting dissolved, lingers
        if (p.type === 'drift_death_stain') {
            const t = p.timer / 4.0;
            const s = p.size || 12;
            
            ctx.globalAlpha = t * 0.15;
            ctx.fillStyle = '#1a1816';
            ctx.beginPath();
            ctx.ellipse(sx, sy, s, s * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Faint ring at edge
            ctx.strokeStyle = `rgba(50,45,38,${t * 0.1})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.ellipse(sx, sy, s * 1.1, s * 0.45, 0, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.globalAlpha = 1;
        }
        
        // ── NEW SKILL PARTICLE RENDERING ──
        
        // Dash trail — brief muted afterimage
        if (p.type === 'dash_trail') {
            ctx.globalAlpha = Math.min(0.8, p.timer * 3);
            ctx.fillStyle = '#8a7560';
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 3) * 1.3, 0, Math.PI * 2);
            ctx.fill();
            // Bright core
            ctx.fillStyle = `rgba(200,180,140,${Math.min(0.6, p.timer * 2)})`;
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 3) * 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // Shadow trail — dark, creeping, sinister
        if (p.type === 'shadow_trail') {
            ctx.globalAlpha = Math.min(0.85, p.timer * 2.5);
            ctx.fillStyle = '#2a102a';
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 3) * 1.5, 0, Math.PI * 2);
            ctx.fill();
            // Inner purple core
            ctx.fillStyle = `rgba(120,40,140,${Math.min(0.7, p.timer * 1.5)})`;
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 3) * 0.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // Shadow emerge — erupting dark energy
        if (p.type === 'shadow_emerge') {
            const t = p.timer / 1.2;
            ctx.globalAlpha = t * 0.9;
            ctx.fillStyle = '#2a0a2f';
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 4) * 1.3 * t, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = `rgba(140,50,180,${t * 0.7})`;
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 4) * t * 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // Shadow fizzle — brief spark that fails
        if (p.type === 'shadow_fizzle') {
            const t = p.timer / 0.6;
            ctx.globalAlpha = t * 0.8;
            ctx.fillStyle = `rgba(80,30,100,${t * 0.7})`;
            ctx.beginPath();
            ctx.arc(sx, sy - 15, (p.size || 10) * 1.2, 0, Math.PI * 2);
            ctx.fill();
            // Crackle lightning
            ctx.strokeStyle = `rgba(160,80,200,${t * 0.6})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(sx - 6, sy - 22);
            ctx.lineTo(sx + 4, sy - 14);
            ctx.lineTo(sx - 3, sy - 8);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
        
        // Reclamation crack — dark spreading line
        if (p.type === 'reclaim_crack') {
            const t = p.timer / 1.5;
            ctx.globalAlpha = t * 0.85;
            ctx.strokeStyle = '#5a7040';
            ctx.lineWidth = (p.size || 1.5) * t * 1.5;
            const angle = p.angle || 0;
            const len = 18 * (1 - t * 0.3);
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + Math.cos(angle) * len, sy + Math.sin(angle) * len * 0.5);
            ctx.stroke();
            // Glow along crack
            ctx.strokeStyle = `rgba(100,150,50,${t * 0.4})`;
            ctx.lineWidth = (p.size || 1.5) * t * 3;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + Math.cos(angle) * len, sy + Math.sin(angle) * len * 0.5);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
        
        // Reclamation spore — small organic rising particle
        if (p.type === 'reclaim_spore') {
            ctx.globalAlpha = Math.min(0.8, p.timer * 1.8);
            ctx.fillStyle = '#6a8a40';
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 2) * 1.3, 0, Math.PI * 2);
            ctx.fill();
            // Glow
            ctx.fillStyle = `rgba(120,180,60,${Math.min(0.4, p.timer)})`;
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 2) * 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // Attunement pulse — expanding ring of clarity
        if (p.type === 'attune_pulse') {
            const maxT = player.attuneTimer + 0.3;
            const t = Math.max(0, p.timer / Math.max(0.1, maxT));
            const r = p.size || 25;
            ctx.globalAlpha = t * 0.7;
            ctx.strokeStyle = `rgba(200,190,140,${t * 0.6})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(sx, sy - 15, r, 0, Math.PI * 2);
            ctx.stroke();
            // Inner glow — warm golden light
            const grad = ctx.createRadialGradient(sx, sy - 15, 0, sx, sy - 15, r);
            grad.addColorStop(0, `rgba(200,180,120,${t * 0.2})`);
            grad.addColorStop(0.5, `rgba(160,140,90,${t * 0.08})`);
            grad.addColorStop(1, 'rgba(120,110,90,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(sx, sy - 15, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // Burden wave — rippling force
        if (p.type === 'burden_wave') {
            ctx.globalAlpha = Math.min(0.9, p.timer * 3);
            ctx.fillStyle = p.color || '#8a6a4a';
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 3) * 1.3, 0, Math.PI * 2);
            ctx.fill();
            // Hot core
            ctx.fillStyle = `rgba(220,160,80,${Math.min(0.5, p.timer * 2)})`;
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 3) * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // Snare deploy — sigil flash
        if (p.type === 'snare_deploy') {
            const t = p.timer / 0.6;
            ctx.globalAlpha = t * 0.8;
            ctx.strokeStyle = `rgba(180,120,220,${t * 0.7})`;
            ctx.lineWidth = 2;
            const r = (p.size || 15) * (1 - t * 0.3);
            ctx.beginPath();
            ctx.arc(sx, sy, r, 0, Math.PI * 2);
            ctx.stroke();
            // Inner sigil flash
            const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 0.7);
            grad.addColorStop(0, `rgba(140,100,180,${t * 0.3})`);
            grad.addColorStop(1, 'rgba(100,60,140,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(sx, sy, r * 0.7, 0, Math.PI * 2);
            ctx.fill();
            // Inner sigil marks
            for (let i = 0; i < 4; i++) {
                const a = (i / 4) * Math.PI * 2 + TIME.elapsed;
                ctx.fillStyle = `rgba(160,100,200,${t * 0.6})`;
                ctx.fillRect(sx + Math.cos(a) * r * 0.5 - 1.5, sy + Math.sin(a) * r * 0.5 - 1.5, 3, 3);
            }
            ctx.globalAlpha = 1;
        }
        
        // Crit flash — sharp bright burst, no numbers
        if (p.type === 'crit_flash') {
            const t = p.timer / 0.25;
            ctx.globalAlpha = t * 0.9;
            ctx.fillStyle = `rgba(255,230,170,${t * 0.7})`;
            ctx.beginPath();
            ctx.arc(sx, sy - 20, (p.size || 8) * t * 1.2, 0, Math.PI * 2);
            ctx.fill();
            // White hot center
            ctx.fillStyle = `rgba(255,255,240,${t * 0.5})`;
            ctx.beginPath();
            ctx.arc(sx, sy - 20, (p.size || 8) * t * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // ══════════════════════════════════════════════
        // ENHANCED SKILL VFX RENDERING
        // ══════════════════════════════════════════════
        
        // ── PREDATORY MOTION (Skill 1) ──
        
        // Dash dust — expanding ground puff
        if (p.type === 'dash_dust') {
            const t = Math.min(1, p.timer * 2);
            ctx.globalAlpha = t * 0.6;
            ctx.fillStyle = `rgba(140,110,80,${t * 0.5})`;
            ctx.beginPath();
            ctx.ellipse(sx, sy, (p.size || 3) * (1.8 - t * 0.3), (p.size || 3) * (0.7 - t * 0.1), 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // Dash streak — elongated speed line
        if (p.type === 'dash_streak') {
            const t = p.timer / 0.25;
            const angle = p.angle || 0;
            // Convert world angle to screen angle
            const endPt = worldToScreen(Math.cos(angle), Math.sin(angle));
            const scrAngle = Math.atan2(endPt.y, endPt.x);
            ctx.globalAlpha = t * 0.8;
            ctx.strokeStyle = `rgba(220,200,160,${t * 0.7})`;
            ctx.lineWidth = 3 * t;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(sx - Math.cos(scrAngle) * 18 * t, sy - Math.sin(scrAngle) * 18 * t);
            ctx.lineTo(sx + Math.cos(scrAngle) * 25 * t, sy + Math.sin(scrAngle) * 25 * t);
            ctx.stroke();
            // Bright white core
            ctx.strokeStyle = `rgba(255,240,200,${t * 0.5})`;
            ctx.lineWidth = 1.2 * t;
            ctx.beginPath();
            ctx.moveTo(sx - Math.cos(scrAngle) * 12 * t, sy - Math.sin(scrAngle) * 12 * t);
            ctx.lineTo(sx + Math.cos(scrAngle) * 20 * t, sy + Math.sin(scrAngle) * 20 * t);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
        
        // ── ADAPTIVE SNARE (Skill 2) ──
        
        // Snare rune — orbiting glyph fragments
        if (p.type === 'snare_rune') {
            const t = Math.min(1, p.timer * 1.5);
            ctx.globalAlpha = t * 0.9;
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate((p.angle || 0) + TIME.elapsed * 2);
            // Glow aura
            ctx.fillStyle = `rgba(140,80,200,${t * 0.25})`;
            ctx.beginPath();
            ctx.arc(0, 0, 5, 0, Math.PI * 2);
            ctx.fill();
            // Small arcane mark
            ctx.fillStyle = `rgba(180,120,240,${t * 0.8})`;
            ctx.fillRect(-1.5, -1.5, 3, 3);
            ctx.strokeStyle = `rgba(160,100,220,${t * 0.6})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-4, 0);
            ctx.lineTo(4, 0);
            ctx.moveTo(0, -4);
            ctx.lineTo(0, 4);
            ctx.stroke();
            ctx.restore();
            ctx.globalAlpha = 1;
        }
        
        // Snare inscription — ground circle with rotating marks
        if (p.type === 'snare_inscription') {
            const t = p.timer / 1.2;
            const r = (p.size || 20) * Math.min(1, (1.2 - p.timer + 0.3) * 2);
            ctx.globalAlpha = t * 0.7;
            // Outer ring
            ctx.strokeStyle = `rgba(160,100,220,${t * 0.6})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(sx, sy, r, r * 0.4, 0, 0, Math.PI * 2);
            ctx.stroke();
            // Inner ring
            ctx.strokeStyle = `rgba(140,80,200,${t * 0.5})`;
            ctx.beginPath();
            ctx.ellipse(sx, sy, r * 0.6, r * 0.24, 0, 0, Math.PI * 2);
            ctx.stroke();
            // Rotating sigil marks around the ring
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2 + TIME.elapsed * 0.5;
                const mx = sx + Math.cos(a) * r * 0.8;
                const my = sy + Math.sin(a) * r * 0.32;
                ctx.fillStyle = `rgba(180,120,240,${t * 0.7})`;
                ctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
            }
            ctx.globalAlpha = 1;
        }
        
        // ── RECLAMATION (Skill 3) ──
        
        // Reclamation pulse — expanding earth tremor ring
        if (p.type === 'reclaim_pulse') {
            const t = p.timer / 1.0;
            const r = (p.size || 8) * TILE_W * 0.15;
            ctx.globalAlpha = t * 0.75;
            ctx.strokeStyle = `rgba(80,120,50,${t * 0.7})`;
            ctx.lineWidth = 3 * t;
            ctx.beginPath();
            ctx.ellipse(sx, sy, r, r * 0.4, 0, 0, Math.PI * 2);
            ctx.stroke();
            // Inner glow
            const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 0.6);
            grad.addColorStop(0, `rgba(60,100,30,${t * 0.25})`);
            grad.addColorStop(1, 'rgba(40,80,25,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.ellipse(sx, sy, r * 0.6, r * 0.24, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // Reclamation tendril — creeping root line
        if (p.type === 'reclaim_tendril') {
            const t = p.timer / 3.0;
            const angle = p.angle || 0;
            const len = (3.0 - p.timer) * 10;
            ctx.globalAlpha = t * 0.8;
            ctx.strokeStyle = `rgba(60,90,35,${t * 0.7})`;
            ctx.lineWidth = 2.5 * t;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            const mid1x = sx + Math.cos(angle) * len * 0.4 + Math.sin(TIME.elapsed * 2) * 4;
            const mid1y = sy + Math.sin(angle) * len * 0.16 + Math.cos(TIME.elapsed * 1.5) * 3;
            const endx = sx + Math.cos(angle) * len;
            const endy = sy + Math.sin(angle) * len * 0.4;
            ctx.quadraticCurveTo(mid1x, mid1y, endx, endy);
            ctx.stroke();
            // Tip glow
            ctx.fillStyle = `rgba(100,160,40,${t * 0.6})`;
            ctx.beginPath();
            ctx.arc(endx, endy, 3 * t, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // ── ATTUNEMENT (Skill 4) ──
        
        // Attune mote — orbiting awareness spark
        if (p.type === 'attune_mote') {
            const maxT = player.attuneTimer + 0.5;
            const t = Math.max(0, p.timer / Math.max(0.1, maxT));
            ctx.globalAlpha = t * 0.9;
            // Outer glow
            ctx.fillStyle = `rgba(200,190,130,${t * 0.35})`;
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 1.5) * 3, 0, Math.PI * 2);
            ctx.fill();
            // Core dot — bright
            ctx.fillStyle = `rgba(255,240,180,${t * 0.8})`;
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 1.5) * 1.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // Attune glyph — intricate ground circle
        if (p.type === 'attune_glyph') {
            const maxT = player.attuneTimer + 0.3;
            const t = Math.max(0, p.timer / Math.max(0.1, maxT));
            const r = p.size || 22;
            ctx.globalAlpha = t * 0.6;
            // Outer circle
            ctx.strokeStyle = `rgba(200,190,140,${t * 0.55})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(sx, sy, r, r * 0.4, 0, 0, Math.PI * 2);
            ctx.stroke();
            // Inner circle
            ctx.strokeStyle = `rgba(180,170,120,${t * 0.4})`;
            ctx.beginPath();
            ctx.ellipse(sx, sy, r * 0.5, r * 0.2, 0, 0, Math.PI * 2);
            ctx.stroke();
            // Cross-hairs / awareness markers rotating
            for (let i = 0; i < 4; i++) {
                const a = (i / 4) * Math.PI * 2 + TIME.elapsed * 0.8;
                const mx = sx + Math.cos(a) * r * 0.75;
                const my = sy + Math.sin(a) * r * 0.3;
                ctx.strokeStyle = `rgba(220,200,150,${t * 0.5})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(mx - 4, my);
                ctx.lineTo(mx + 4, my);
                ctx.moveTo(mx, my - 3);
                ctx.lineTo(mx, my + 3);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }
        
        // Attune bloom — initial light burst
        if (p.type === 'attune_bloom') {
            const t = p.timer / 0.6;
            const r = (p.size || 35) * (1 - t * 0.3);
            ctx.globalAlpha = t * 0.5;
            const grad = ctx.createRadialGradient(sx, sy - 15, 0, sx, sy - 15, r);
            grad.addColorStop(0, `rgba(240,220,160,${t * 0.4})`);
            grad.addColorStop(0.4, `rgba(200,180,120,${t * 0.15})`);
            grad.addColorStop(1, 'rgba(160,140,90,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(sx, sy - 15, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // ── BURDEN SHIFT (Skill 5) ──
        
        // Burden shockwave — expanding ground ring
        if (p.type === 'burden_shockwave') {
            const t = p.timer / 0.8;
            const r = p.size || 10;
            ctx.globalAlpha = t * 0.8;
            ctx.strokeStyle = `rgba(200,150,80,${t * 0.7})`;
            ctx.lineWidth = 3.5 * t;
            ctx.beginPath();
            ctx.ellipse(sx, sy, r, r * 0.4, 0, 0, Math.PI * 2);
            ctx.stroke();
            // Inner glow pulse
            const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 0.7);
            grad.addColorStop(0, `rgba(180,130,50,${t * 0.2})`);
            grad.addColorStop(1, 'rgba(140,100,40,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.ellipse(sx, sy, r * 0.7, r * 0.28, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // Burden shard — flying eruption debris
        if (p.type === 'burden_shard') {
            const t = Math.min(1, p.timer * 1.2);
            ctx.globalAlpha = t * 0.9;
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate((p.angle || 0) + TIME.elapsed * 5);
            ctx.fillStyle = '#7a4a2a';
            const s = (p.size || 2) * 1.3;
            ctx.fillRect(-s, -s * 0.4, s * 2, s * 0.8);
            ctx.restore();
            // Hot core
            ctx.fillStyle = `rgba(240,150,50,${t * 0.6})`;
            ctx.beginPath();
            ctx.arc(sx, sy, s * 0.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // Burden absorb — inward-rushing cool motes (restraint)
        if (p.type === 'burden_absorb') {
            const t = Math.min(1, p.timer * 2);
            ctx.globalAlpha = t * 0.8;
            ctx.fillStyle = `rgba(80,120,160,${t * 0.7})`;
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 2) * 1.3, 0, Math.PI * 2);
            ctx.fill();
            // Trail line back toward center
            ctx.strokeStyle = `rgba(100,140,180,${t * 0.4})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + (p.vx || 0) * -5, sy + (p.vy || 0) * -5);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
        
        // Burden vapor — rising cost smoke
        if (p.type === 'burden_vapor') {
            const t = Math.min(1, p.timer * 0.8);
            ctx.globalAlpha = t * 0.5;
            const r = (p.size || 4) * 1.3;
            const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
            grad.addColorStop(0, `rgba(120,70,40,${t * 0.45})`);
            grad.addColorStop(1, 'rgba(80,50,30,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(sx, sy, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // ── SHADOW ACKNOWLEDGEMENT (Skill 6) ──
        
        // Shadow tendril — creeping dark arm
        if (p.type === 'shadow_tendril') {
            const t = p.timer / 2.0;
            const angle = p.angle || 0;
            const len = (2.0 - p.timer + 0.5) * 12;
            ctx.globalAlpha = t * 0.85;
            ctx.strokeStyle = `rgba(50,15,70,${t * 0.8})`;
            ctx.lineWidth = (p.size || 3) * t * 1.3;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            const wavex = sx + Math.cos(angle) * len + Math.sin(TIME.elapsed * 3 + angle) * 5;
            const wavey = sy + Math.sin(angle) * len * 0.5 + Math.cos(TIME.elapsed * 2) * 3;
            ctx.quadraticCurveTo(
                sx + Math.cos(angle) * len * 0.5 + Math.sin(TIME.elapsed * 4) * 4,
                sy + Math.sin(angle) * len * 0.25,
                wavex, wavey
            );
            ctx.stroke();
            // Tip glow — bright purple
            ctx.fillStyle = `rgba(140,40,180,${t * 0.6})`;
            ctx.beginPath();
            ctx.arc(wavex, wavey, 4 * t, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // Shadow corruption — dark ground stain
        if (p.type === 'shadow_corruption') {
            const totalT = player.shadowTimer || 5;
            const t = Math.min(1, p.timer / Math.max(0.1, totalT));
            const r = (p.size || 30) * Math.min(1, (totalT - p.timer + 1) * 0.5);
            ctx.globalAlpha = t * 0.4;
            const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
            grad.addColorStop(0, `rgba(40,10,55,${t * 0.4})`);
            grad.addColorStop(0.6, `rgba(30,8,45,${t * 0.2})`);
            grad.addColorStop(1, 'rgba(20,5,30,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.ellipse(sx, sy, r, r * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();
            // Pulsing inner edge
            const pulse = Math.sin(TIME.elapsed * 4) * 0.08;
            ctx.strokeStyle = `rgba(100,30,140,${t * (0.3 + pulse)})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(sx, sy, r * 0.8, r * 0.32, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
        
        // Shadow vortex — swirling purple mote
        if (p.type === 'shadow_vortex') {
            const t = Math.min(1, p.timer * 0.8);
            ctx.globalAlpha = t * 0.9;
            // Outer glow
            ctx.fillStyle = `rgba(80,20,120,${t * 0.35})`;
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 2) * 3, 0, Math.PI * 2);
            ctx.fill();
            // Core
            ctx.fillStyle = `rgba(160,50,220,${t * 0.7})`;
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 2) * 1.2, 0, Math.PI * 2);
            ctx.fill();
            // Trail streak
            ctx.strokeStyle = `rgba(140,40,180,${t * 0.4})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx - (p.vx || 0) * 4, sy - (p.vy || 0) * 4);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
        
        // Shadow flash — dark energy burst
        if (p.type === 'shadow_flash') {
            const t = p.timer / 0.5;
            const r = (p.size || 40) * 1.2;
            ctx.globalAlpha = t * 0.7;
            const grad = ctx.createRadialGradient(sx, sy - 20, 0, sx, sy - 20, r);
            grad.addColorStop(0, `rgba(80,20,120,${t * 0.6})`);
            grad.addColorStop(0.3, `rgba(50,12,80,${t * 0.3})`);
            grad.addColorStop(1, 'rgba(25,5,40,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(sx, sy - 20, r, 0, Math.PI * 2);
            ctx.fill();
            // Lightning cracks radiating from center
            ctx.strokeStyle = `rgba(180,60,240,${t * 0.7})`;
            ctx.lineWidth = 1.5 * t;
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2 + t * 2;
                ctx.beginPath();
                ctx.moveTo(sx, sy - 20);
                const bx = sx + Math.cos(a) * r * 0.4 + (Math.random() - 0.5) * 5;
                const by = sy - 20 + Math.sin(a) * r * 0.4 + (Math.random() - 0.5) * 4;
                ctx.lineTo(bx, by);
                const cx = bx + Math.cos(a) * r * 0.3 + (Math.random() - 0.5) * 7;
                const cy = by + Math.sin(a) * r * 0.3 + (Math.random() - 0.5) * 5;
                ctx.lineTo(cx, cy);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }
        
        // ── LINGERING PARTICLES ──
        
        // Linger panic — jittery frustration sparks, warm brown-red
        if (p.type === 'linger_panic') {
            const t = Math.min(1, p.timer * 3);
            ctx.globalAlpha = t * 0.6;
            ctx.fillStyle = '#6a4030';
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 2) * t, 0, Math.PI * 2);
            ctx.fill();
            // Hot core
            ctx.fillStyle = `rgba(140,80,50,${t * 0.4})`;
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 2) * t * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // Linger fade — soft, sad wisps dissipating, muted brown
        if (p.type === 'linger_fade') {
            const t = p.timer / 2.5;
            ctx.globalAlpha = Math.min(0.35, t * 0.5);
            ctx.fillStyle = '#3a302a';
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 2), 0, Math.PI * 2);
            ctx.fill();
            // Faint haze
            ctx.fillStyle = `rgba(60,50,40,${t * 0.15})`;
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 2) * 1.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // Linger stain — ground mark where avoidance ended
        if (p.type === 'linger_stain') {
            const t = p.timer / 3.0;
            ctx.globalAlpha = t * 0.12;
            ctx.fillStyle = '#251f1a';
            ctx.beginPath();
            ctx.ellipse(sx, sy, (p.size || 8), (p.size || 8) * 0.35, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // ── HUDDLED PARTICLES ──
        
        // Huddle grief — reaching pale tendrils
        if (p.type === 'huddle_grief') {
            const t = Math.min(1, p.timer * 1.5);
            ctx.globalAlpha = t * 0.5;
            // Dim reaching light
            ctx.strokeStyle = `rgba(90,80,65,${t * 0.4})`;
            ctx.lineWidth = (p.size || 2) * 0.6;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + (p.vx || 0) * 4, sy + (p.vy || 0) * 4);
            ctx.stroke();
            // Tip dot
            ctx.fillStyle = '#5a5040';
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 2) * 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // Huddle panic — scattered, frightened specks
        if (p.type === 'huddle_panic') {
            const t = Math.min(1, p.timer * 2.5);
            ctx.globalAlpha = t * 0.5;
            ctx.fillStyle = '#3a3028';
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 2) * t, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // ── REHEARSED PARTICLES ──
        
        // Rehearsed shatter — angular geometric debris
        if (p.type === 'rehearsed_shatter') {
            const t = Math.min(1, p.timer * 3);
            ctx.globalAlpha = t * 0.6;
            const s = (p.size || 2) * t;
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(p.timer * 5 + (p.size || 0));
            ctx.fillStyle = '#8a7a50';
            // Sharp angular fragment
            ctx.beginPath();
            ctx.moveTo(-s, 0);
            ctx.lineTo(0, -s * 0.6);
            ctx.lineTo(s * 0.8, 0);
            ctx.lineTo(0, s * 0.4);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
            ctx.globalAlpha = 1;
        }
        
        // Rehearsed fragment — script pieces scattering
        if (p.type === 'rehearsed_fragment') {
            const t = Math.min(1, p.timer / 1.5);
            ctx.globalAlpha = t * 0.7;
            const s = (p.size || 2);
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(p.timer * 3 + (p.vx || 0));
            // Rectangle shard — like a torn page
            ctx.fillStyle = `rgba(130,110,70,${t * 0.6})`;
            ctx.fillRect(-s * 0.8, -s * 0.3, s * 1.6, s * 0.6);
            // Ink marks
            ctx.fillStyle = `rgba(60,50,30,${t * 0.4})`;
            ctx.fillRect(-s * 0.4, -s * 0.1, s * 0.5, s * 0.2);
            ctx.restore();
            ctx.globalAlpha = 1;
        }
        
        // Rehearsed step — metronomic footfall puff
        if (p.type === 'rehearsed_step') {
            const t = Math.min(1, p.timer * 4);
            ctx.globalAlpha = t * 0.25;
            ctx.fillStyle = '#4a4030';
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 2), 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // Rehearsed death ring — expanding pattern collapse ring
        if (p.type === 'rehearsed_death_ring') {
            const t = p.timer / 1.0;
            const r = p.size || 20;
            ctx.globalAlpha = t * 0.35;
            // Outer ring
            ctx.strokeStyle = `rgba(160,130,70,${t * 0.3})`;
            ctx.lineWidth = 2 * t;
            ctx.setLineDash([4, 4]); // dashed — the pattern is broken
            ctx.beginPath();
            ctx.arc(sx, sy - 15, r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            // Inner pulse
            const grad = ctx.createRadialGradient(sx, sy - 15, 0, sx, sy - 15, r * 0.5);
            grad.addColorStop(0, `rgba(140,120,60,${t * 0.15})`);
            grad.addColorStop(1, 'rgba(100,80,40,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(sx, sy - 15, r * 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // ── BURDENED PARTICLES ──
        
        // Burden shed — heavy dark chunks dropping
        if (p.type === 'burden_shed') {
            const t = Math.min(1, p.timer / 2.0);
            ctx.globalAlpha = t * 0.7;
            const s = (p.size || 3);
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(p.timer * 2 + (p.vx || 0));
            ctx.fillStyle = '#1a1510';
            ctx.fillRect(-s / 2, -s / 2, s, s * 0.8);
            // Dark edge
            ctx.fillStyle = `rgba(40,35,25,${t * 0.5})`;
            ctx.fillRect(-s / 2, -s / 2, s, s * 0.3);
            ctx.restore();
            ctx.globalAlpha = 1;
        }
        
        // Burden crumble — smaller debris flaking off
        if (p.type === 'burden_crumble') {
            const t = Math.min(1, p.timer * 2.5);
            ctx.globalAlpha = t * 0.5;
            ctx.fillStyle = '#2a2218';
            const s = (p.size || 2) * t;
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(p.timer * 4);
            ctx.fillRect(-s / 2, -s / 3, s, s * 0.6);
            ctx.restore();
            ctx.globalAlpha = 1;
        }
        
        // Burden impact — ground cracks radiating from death point
        if (p.type === 'burden_impact') {
            const t = p.timer / 1.5;
            ctx.globalAlpha = t * 0.35;
            const angle = Math.atan2(p.vy || 0, p.vx || 0);
            ctx.strokeStyle = '#1a1510';
            ctx.lineWidth = (p.size || 4) * t * 0.5;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            const len = 8 + (p.size || 4) * 2;
            ctx.lineTo(sx + Math.cos(angle) * len * (1 - t * 0.3), sy + Math.sin(angle) * len * 0.5 * (1 - t * 0.3));
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
        
        // Burden trail — dragging ground marks
        if (p.type === 'burden_trail') {
            const t = Math.min(1, p.timer * 3);
            ctx.globalAlpha = t * 0.2;
            ctx.fillStyle = '#1a1510';
            ctx.beginPath();
            ctx.ellipse(sx, sy, (p.size || 2) * 1.2, (p.size || 2) * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // Burden step — heavy footfall impact puff
        if (p.type === 'burden_step') {
            const t = Math.min(1, p.timer * 4);
            ctx.globalAlpha = t * 0.3;
            ctx.fillStyle = '#2a2418';
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 2), 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // ── DEFERRED PARTICLES ──
        
        // Deferred pressure — internal tension leaking upward, sickly amber
        if (p.type === 'deferred_pressure') {
            const t = Math.min(1, p.timer * 3);
            ctx.globalAlpha = t * 0.45;
            ctx.fillStyle = '#7a6030';
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 2), 0, Math.PI * 2);
            ctx.fill();
            // Hot core
            ctx.fillStyle = `rgba(160,120,50,${t * 0.3})`;
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 2) * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // Deferred unfurl — unfolding warning wisps
        if (p.type === 'deferred_unfurl') {
            const t = Math.min(1, p.timer * 2);
            ctx.globalAlpha = t * 0.4;
            ctx.fillStyle = '#8a6a30';
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 3), 0, Math.PI * 2);
            ctx.fill();
            // Spreading haze
            ctx.fillStyle = `rgba(100,80,40,${t * 0.15})`;
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 3) * 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // Deferred eruption — violent stored-cost explosion, bright amber-orange
        if (p.type === 'deferred_eruption') {
            const t = Math.min(1, p.timer / 1.2);
            ctx.globalAlpha = t * 0.7;
            // Outer hot glow
            ctx.fillStyle = `rgba(180,120,40,${t * 0.4})`;
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 2) * 1.3, 0, Math.PI * 2);
            ctx.fill();
            // Core
            ctx.fillStyle = '#c09040';
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 2) * 0.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // Deferred pulse — expanding damage wave ring
        if (p.type === 'deferred_pulse') {
            const t = p.timer / 0.4;
            const r = p.size || 15;
            ctx.globalAlpha = t * 0.3;
            ctx.strokeStyle = `rgba(180,140,50,${t * 0.3})`;
            ctx.lineWidth = 2.5 * t;
            ctx.beginPath();
            ctx.arc(sx, sy - 10, r, 0, Math.PI * 2);
            ctx.stroke();
            // Inner pulse fill
            const grad = ctx.createRadialGradient(sx, sy - 10, 0, sx, sy - 10, r);
            grad.addColorStop(0, `rgba(160,120,40,${t * 0.08})`);
            grad.addColorStop(1, 'rgba(120,90,30,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(sx, sy - 10, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // Deferred relief — ascending calm light, cooler tone
        if (p.type === 'deferred_relief') {
            const t = p.timer / 2.0;
            const r = p.size || 10;
            ctx.globalAlpha = t * 0.25;
            // Soft ascending glow
            const grad = ctx.createRadialGradient(sx, sy - 20, 0, sx, sy - 20, r);
            grad.addColorStop(0, `rgba(140,130,100,${t * 0.2})`);
            grad.addColorStop(0.6, `rgba(100,95,75,${t * 0.1})`);
            grad.addColorStop(1, 'rgba(80,75,60,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(sx, sy - 20, r, 0, Math.PI * 2);
            ctx.fill();
            // Rising spark
            ctx.fillStyle = `rgba(160,150,120,${t * 0.35})`;
            ctx.beginPath();
            ctx.arc(sx, sy - 20 - (1 - t) * 8, 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // ── REMEMBERED PARTICLES ──
        
        // Remembered echo — dark player-like afterimage fragments
        if (p.type === 'remembered_echo') {
            const t = Math.min(1, p.timer / 2.0);
            ctx.globalAlpha = t * 0.4;
            // Dark silhouette fragment
            ctx.fillStyle = '#1a181a';
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 2), 0, Math.PI * 2);
            ctx.fill();
            // Pale reflection edge
            ctx.strokeStyle = `rgba(100,95,90,${t * 0.3})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 2) * 1.2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
        
        // Remembered strike — echo attack sparks, cool grey-blue
        if (p.type === 'remembered_strike') {
            const t = Math.min(1, p.timer * 3);
            ctx.globalAlpha = t * 0.6;
            ctx.fillStyle = '#6a6570';
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 2) * t, 0, Math.PI * 2);
            ctx.fill();
            // Core
            ctx.fillStyle = `rgba(140,130,150,${t * 0.4})`;
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 2) * t * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // Remembered shimmer — uncanny aura, barely visible
        if (p.type === 'remembered_shimmer') {
            const t = Math.min(1, p.timer / 0.8);
            ctx.globalAlpha = t * 0.2;
            ctx.fillStyle = 'rgba(80,78,85,0.3)';
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 2) * 1.5, 0, Math.PI * 2);
            ctx.fill();
            // Flicker core
            const flicker = Math.sin(TIME.elapsed * 12 + (p.size || 0)) * 0.5 + 0.5;
            ctx.fillStyle = `rgba(100,95,105,${t * 0.15 * flicker})`;
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 2) * 0.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // Remembered crack — mirror shattering, angular glass lines
        if (p.type === 'remembered_crack') {
            const t = Math.min(1, p.timer / 1.0);
            ctx.globalAlpha = t * 0.6;
            const s = (p.size || 2);
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(p.timer * 6 + (p.vx || 0) * 2);
            // Glass shard
            ctx.fillStyle = `rgba(140,135,145,${t * 0.5})`;
            ctx.beginPath();
            ctx.moveTo(-s, 0);
            ctx.lineTo(-s * 0.2, -s * 0.8);
            ctx.lineTo(s, 0);
            ctx.lineTo(s * 0.2, s * 0.6);
            ctx.closePath();
            ctx.fill();
            // Reflection line
            ctx.strokeStyle = `rgba(200,195,210,${t * 0.3})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(-s * 0.3, -s * 0.2);
            ctx.lineTo(s * 0.4, s * 0.1);
            ctx.stroke();
            ctx.restore();
            ctx.globalAlpha = 1;
        }
        
        // Remembered death glow — fading memorial, ghostly
        if (p.type === 'remembered_death_glow') {
            const t = p.timer / 2.5;
            const r = p.size || 15;
            ctx.globalAlpha = t * 0.2;
            // Outer haze
            const grad = ctx.createRadialGradient(sx, sy - 20, 0, sx, sy - 20, r);
            grad.addColorStop(0, `rgba(100,95,110,${t * 0.15})`);
            grad.addColorStop(0.5, `rgba(70,65,80,${t * 0.08})`);
            grad.addColorStop(1, 'rgba(50,48,55,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(sx, sy - 20, r, 0, Math.PI * 2);
            ctx.fill();
            // Flickering inner point
            const flicker = Math.sin(TIME.elapsed * 8 + r) * 0.3 + 0.7;
            ctx.fillStyle = `rgba(130,125,145,${t * 0.25 * flicker})`;
            ctx.beginPath();
            ctx.arc(sx, sy - 20, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // Campfire ember — warm floating spark
        if (p.type === 'campfire_ember') {
            const t = Math.min(1, p.timer * 2);
            ctx.globalAlpha = t * 0.8;
            ctx.fillStyle = `rgba(220,160,40,${t * 0.7})`;
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 1.5), 0, Math.PI * 2);
            ctx.fill();
            // Hot core
            ctx.fillStyle = `rgba(255,220,100,${t * 0.5})`;
            ctx.beginPath();
            ctx.arc(sx, sy, (p.size || 1.5) * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // Insight text — floating XP numbers
        if (p.type === 'insight_text') {
            const t = Math.min(1, p.timer / 1.8);
            ctx.globalAlpha = t;
            ctx.font = `bold ${p.size || 12}px Georgia, serif`;
            ctx.textAlign = 'center';
            ctx.fillStyle = p.color || 'rgba(200,180,140,0.8)';
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 4;
            ctx.fillText(p.text || '+0', sx, sy);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        }
        
        // Level up — golden ascending sparks
        if (p.type === 'level_up') {
            const t = p.timer / 2.0;
            const s = (p.size || 3) * (1 + (1 - t) * 0.5);
            ctx.globalAlpha = t * 0.85;
            // Outer glow
            ctx.fillStyle = `rgba(220,180,80,${t * 0.4})`;
            ctx.beginPath();
            ctx.arc(sx, sy, s * 1.5, 0, Math.PI * 2);
            ctx.fill();
            // Core
            ctx.fillStyle = `rgba(250,220,120,${t * 0.8})`;
            ctx.beginPath();
            ctx.arc(sx, sy, s * 0.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }
    
    // Hub boundary — subtle safety ring
    if (gameState === GameState.HUB || gameState === GameState.EXPLORING) {
        const hubCenter = worldToScreen(WORLD_SIZE / 2, WORLD_SIZE / 2);
        const hcx = hubCenter.x + cam.x;
        const hcy = hubCenter.y + cam.y;
        const hubR = HUB_SAFE_RADIUS * TILE_W * 0.35;
        
        // Very faint boundary that pulses
        const hubAlpha = gameState === GameState.HUB ? 0.04 : 0.015;
        const hubPulse = Math.sin(TIME.elapsed * 0.5) * 0.005;
        ctx.strokeStyle = `rgba(80,65,50,${hubAlpha + hubPulse})`;
        ctx.lineWidth = 0.5;
        ctx.setLineDash([8, 12]);
        ctx.beginPath();
        ctx.ellipse(hcx, hcy, hubR, hubR * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Hub lantern glow at center
        if (isPlayerInHub()) {
            const glowR = 80 + Math.sin(TIME.elapsed * 1.5) * 10;
            const glow = ctx.createRadialGradient(hcx, hcy - 40, 0, hcx, hcy - 40, glowR);
            glow.addColorStop(0, `rgba(60,45,25,${0.04 + Math.sin(TIME.elapsed * 2) * 0.01})`);
            glow.addColorStop(1, 'rgba(60,45,25,0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(hcx, hcy - 40, glowR, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Atmospheric ground fog — drifting haze patches
    renderAtmosphericFog(cam);
    
    // Ambient leaves and dust
    renderAmbientParticles(cam);
    
    // Haze overlay
    renderHaze(cam);
    // red panic tint when compulsion high
    try {
        if (greyline.getSide() === 'compulsion' && greyline.getExtremity() > 0.5) {
            const alpha = Math.pow(greyline.getExtremity(),2) * 0.15;
            ctx.save();
            ctx.globalAlpha = alpha + Math.random()*0.05;
            ctx.fillStyle = 'rgba(160,0,0,1)';
            ctx.fillRect(0,0,canvas.width,canvas.height);
            ctx.restore();
        }
    } catch(e) {}
    
    // End zoom transform — everything after is screen-space
    ctx.restore();
    
    // Vignette (screen-space, not zoomed)
    renderVignette();
    
    // Canvas HUD — orbs, skill bar, greyline, XP bar, psych stats
    renderCanvasHUD();

    // Greyline post FX (static/grain/tears) — tied to extremity.
    renderGreylinePostFX();

    // Store frame for next-frame ghosting (screen-space)
    ensurePostBuffers();
    lastFrameCtx.globalAlpha = 1.0;
    lastFrameCtx.setTransform(1,0,0,1,0,0);
    lastFrameCtx.clearRect(0,0,lastFrameCanvas.width,lastFrameCanvas.height);
    lastFrameCtx.drawImage(canvas, 0, 0);
}

// ============================================================
// SKILL DATA — for canvas HUD rendering
// ============================================================
const SKILL_DATA = [
    { key: 'predatory',    name: 'Predatory Motion',      imageKey: 'skillPredatory', hotkey: '1', maxCd: 1.2 },
    { key: 'snare',        name: 'Adaptive Snare',        imageKey: 'skillSnare',     hotkey: '2', maxCd: 2.5 },
    { key: 'reclaim',      name: 'Reclamation',           imageKey: 'skillReclaim',   hotkey: '3', maxCd: 8 },
    { key: 'attune',       name: 'Attunement',            imageKey: 'skillAttune',    hotkey: '4', maxCd: 4 },
    { key: 'burdenShift',  name: 'Burden Shift',          imageKey: 'skillBurden',    hotkey: '5', maxCd: 7 },
    { key: 'shadow',       name: 'Shadow Acknowledgement', imageKey: 'skillShadow',   hotkey: '6', maxCd: 18 },
];

// ============================================================
// CANVAS HUD RENDERER — Replaces DOM-based HUD with asset-driven rendering
// Orbs for health/stamina/burden, asset skill icons with cooldown sweep,
// Greyline with gargoyle bar, XP bar, psych stats with better visibility
// ============================================================
function renderCanvasHUD() {
    const W = canvas.width;
    const H = canvas.height;
    // Calculate the visible portion of the internal canvas when CSS-scaled & cropped.
    // This lets HUD elements (orbs, skill bar, ammo) anchor to the visible region instead
    // of being pushed off-screen when the canvas is zoomed to fill the viewport.
    const vp = getViewportDims();
    const displayScale = Math.max(vp.w / FIXED_CANVAS_W, vp.h / FIXED_CANVAS_H);
    const visibleCanvasH = vp.h / displayScale; // in internal canvas pixels
    const visibleTop = Math.round((H - visibleCanvasH) / 2);
    const visibleBottom = Math.round(visibleTop + visibleCanvasH);

    // Scale based on canvas size but with a much higher minimum for readability
    const rawScale = Math.min(W / 1920, H / 1080);
    const s = Math.max(0.85, rawScale * 1.35); // UI scale: larger, min 0.85
    
    ctx.save();

    // Greyline-driven UI legibility (interpretive, not instructional)
    const uiK = greyline.knobs?.ui || { clarity: 1, jitter: 0, warn: 0 };
    ctx.globalAlpha *= (uiK.clarity ?? 1.0);
    if ((uiK.jitter ?? 0) > 0.01) {
        const j = (uiK.jitter ?? 0) * 2.0;
        ctx.translate((Math.random() - 0.5) * j, (Math.random() - 0.5) * j);
    }

    // ── CONTAINER BORDER — TOP-LEFT (Rank + Orbs area) ──
    const leftContainerTop = visibleTop + Math.round(8 * s);
    const leftContainerBottomPad = Math.round(32 * s);
    const leftContainerHeight = Math.max(Math.round(120 * s), visibleBottom - leftContainerBottomPad - (visibleTop + Math.round(8 * s)));
    drawHudContainerBorder(
        Math.round(10 * s), leftContainerTop,
        Math.round(200 * s), leftContainerHeight,
        s, 'left'
    );
    
    // ── CONTAINER BORDER — TOP-RIGHT (Psych Stats + Gold) ──
    drawHudContainerBorder(
        W - Math.round(210 * s), visibleTop + Math.round(8 * s),
        Math.round(200 * s), Math.round(180 * s),
        s, 'right'
    );
    
    // ── ORB-BASED RESOURCE DISPLAY (bottom-left) ──
    const orbSize = Math.round(58 * s);
    const orbSpacing = Math.round(10 * s);
    const orbBaseX = Math.round(24 * s);
    const orbBaseY = visibleBottom - Math.round(100 * s);
    
    // Health Orb
    drawResourceOrb(orbBaseX, orbBaseY - orbSize * 2 - orbSpacing * 2, orbSize, 
        'uiHealthOrb', player.health / player.maxHealth, 
        'rgba(160,50,40,0.7)', 'INTEGRITY', player.health, player.maxHealth);
    
    // Stamina Orb
    drawResourceOrb(orbBaseX, orbBaseY - orbSize - orbSpacing, orbSize, 
        'uiStaminaOrb', player.stamina / player.maxStamina, 
        'rgba(110,120,60,0.7)', 'STAMINA', player.stamina, player.maxStamina);
    
    // Burden Orb
    drawResourceOrb(orbBaseX, orbBaseY, orbSize, 
        'uiBurdenOrb', player.burden / player.maxBurden, 
        'rgba(90,50,130,0.7)', 'BURDEN', player.burden, player.maxBurden);

    // ── GUN AMMO (moved lower-right and slightly ornate) ──
    // Place ammo counter bottom-right to avoid overlapping the center skill bar
    const ammoX = W - Math.round(220 * s);
    const ammoY = visibleBottom - Math.round(72 * s);
    ctx.save();
    ctx.globalAlpha *= 0.98;
    // Decorative label
    ctx.font = `${Math.round(13 * s)}px "Trebuchet MS", Arial`;
    ctx.fillStyle = 'rgba(240,235,220,0.92)';
    ctx.fillText('AMMO', ammoX + Math.round(8 * s), ammoY - Math.round(14 * s));

    // Ornate panel background
    const barW = Math.round(160 * s);
    const barH = Math.round(12 * s);
    const pad = Math.round(8 * s);
    const panelX = ammoX;
    const panelY = ammoY - Math.round(6 * s);
    // Soft rounded background
    roundRect(ctx, panelX - pad, panelY - pad, barW + pad * 2, barH + pad * 2, Math.round(6 * s));
    ctx.fillStyle = 'rgba(18,18,20,0.64)';
    ctx.fill();
    // Subtle border
    ctx.strokeStyle = 'rgba(220,200,160,0.08)';
    ctx.lineWidth = Math.max(1, Math.round(1 * s));
    ctx.stroke();

    // Ammo bar
    const barY = panelY;
    const frac = player.maxAmmo ? (player.ammo / player.maxAmmo) : 0;
    ctx.fillStyle = 'rgba(80,78,70,0.14)';
    ctx.fillRect(panelX, barY, barW, barH);
    ctx.fillStyle = 'rgba(220,205,120,0.88)';
    ctx.fillRect(panelX, barY, Math.round(barW * frac), barH);

    // Ammo numeric readout
    ctx.fillStyle = 'rgba(235,230,210,0.95)';
    ctx.font = `${Math.round(12 * s)}px "Georgia", serif`;
    ctx.fillText(`${player.ammo}/${player.maxAmmo}`, panelX + barW + Math.round(12 * s), barY + Math.round(barH * 0.85));

    // Reload hint
    if (player.reloading) {
        const r = Math.max(0, Math.min(1, 1 - (player.reloadTimer / 2.2)));
        ctx.fillStyle = 'rgba(220,220,220,0.7)';
        ctx.fillText('reloading...', panelX, barY + barH + Math.round(20 * s));
        ctx.fillStyle = 'rgba(220,220,220,0.18)';
        ctx.fillRect(panelX, barY + barH + Math.round(26 * s), barW, Math.round(6 * s));
        ctx.fillStyle = 'rgba(220,220,220,0.46)';
        ctx.fillRect(panelX, barY + barH + Math.round(26 * s), barW * r, Math.round(6 * s));
    } else if (player.ammo === 0) {
        ctx.fillStyle = 'rgba(220,220,220,0.6)';
        ctx.fillText('right-click to reload', panelX, barY + barH + Math.round(20 * s));
    }
    ctx.restore();
    
    // ── SKILL BAR (bottom-center) ──
    const skillSlotSize = Math.round(52 * s);
    const skillGap = Math.round(8 * s);
    const totalSkillBarW = SKILL_DATA.length * skillSlotSize + (SKILL_DATA.length - 1) * skillGap;
    const skillBarX = (W - totalSkillBarW) / 2;
    // Move skills slightly up so they don't crowd bottom elements when canvas is cropped
    const skillBarY = visibleBottom - Math.round(100 * s);
    
    for (let i = 0; i < SKILL_DATA.length; i++) {
        const sd = SKILL_DATA[i];
        const sx = skillBarX + i * (skillSlotSize + skillGap);
        const sy = skillBarY;
        const cd = player.cooldowns[sd.key] || 0;
        const usage = player.skillUsage[sd.key] || 0;
        const upgradeLevel = progression.getSkillLevel(sd.key);
        drawSkillSlot(sx, sy, skillSlotSize, sd, cd, sd.maxCd, usage, upgradeLevel, s);
    }
    
    // ── GREYLINE BAR (bottom-center, below skills) ──
    // Place greyline below the skills with an explicit gap for breathing room
    const glBarW = Math.round(360 * s);
    const glBarH = Math.round(28 * s);
    const glBarX = (W - glBarW) / 2;
    const glBarY = skillBarY + skillSlotSize + Math.round(12 * s);
    drawGreylineBar(glBarX, glBarY, glBarW, glBarH, s);
    
    // ── PROGRESSION / XP BAR (move to top-center for better visibility)
    const xpBarW = Math.round(360 * s);
    const xpBarH = Math.round(18 * s);
    const xpBarX = (W - xpBarW) / 2;
    const xpBarY = visibleTop + Math.round(44 * s);
    drawXpBar(xpBarX, xpBarY, xpBarW, xpBarH, s);

    // ── HAZE HINT: show prompt to hide when walking through fog
    try {
        const inHaze = isPlayerInHaze();
        const playerSpeed = Math.sqrt((player.vx||0)**2 + (player.vy||0)**2);
        if (inHaze && playerSpeed < 0.45 && (player._hideInFogTimer || 0) < 3) {
            ctx.save();
            ctx.setTransform(1,0,0,1,0,0);
            ctx.font = `bold ${Math.round(18 * s)}px Georgia, serif`;
            ctx.fillStyle = 'rgba(230,220,200,0.95)';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 6;
            ctx.fillText('Press SHIFT to hide', canvas.width / 2, canvas.height / 2 + Math.round(40 * s));
            ctx.restore();
        }
    } catch(e) { /* ignore */ }
    
    // ── PSYCH STATS (top-right, enhanced visibility) ──
    drawPsychStats(W, s, visibleTop);
    // DEV: show grain buffer thumbnail + vfx knob readout (F2 toggles)
    if (typeof DEV_VFX_DEBUG !== 'undefined' && DEV_VFX_DEBUG) {
        ctx.save();
        ctx.setTransform(1,0,0,1,0,0);
        const thumbW = 96, thumbH = 96;
        const px = canvas.width - thumbW - 12;
        const py = 12;
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(px-4, py-4, thumbW+8, thumbH+40);
        if (grainCanvas && grainCanvas.width) ctx.drawImage(grainCanvas, px, py, thumbW, thumbH);
        const k = greyline.knobs?.vfx || {};
        ctx.fillStyle = '#fff';
        ctx.font = '12px monospace';
        ctx.fillText(`grain:${(k.grain||0).toFixed(2)} vig:${(k.vignette||0).toFixed(2)}`, px + 4, py + thumbH + 14);
        ctx.fillText(`flick:${(k.flicker||0).toFixed(2)} haze:${(k.hazeEdge||0).toFixed(2)}`, px + 4, py + thumbH + 28);
        ctx.restore();
    }

    // DEV: greyline telemetry / quick readout (F3 toggles)
    if (typeof DEV_GREY_DEBUG !== 'undefined' && DEV_GREY_DEBUG) {
        ctx.save();
        ctx.setTransform(1,0,0,1,0,0);
        const px2 = canvas.width - 96 - 12;
        const py2 = 12 + 96 + 48;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(px2-4, py2-12, 220, 68);
        ctx.fillStyle = '#fff';
        ctx.font = '12px monospace';
        const lp = greyline._lastPush || {};
        ctx.fillText(`g:${(greyline.g||0).toFixed(2)} val:${(greyline.value||0).toFixed(2)} sam:${greyline.samTier||0}`, px2 + 6, py2 + 8);
        ctx.fillText(`time:${(greyline.knobs?.timeScale||1).toFixed(2)} vig:${(greyline.knobs?.vfx?.vignette||0).toFixed(2)} aud.mute:${(greyline.knobs?.aud?.mute||0).toFixed(2)}`, px2 + 6, py2 + 26);
        ctx.fillText(`subBPM:${Math.round(audioEngine?.subBpm||0)} ai.swarm:${(greyline.knobs?.ai?.swarm||0).toFixed(2)}`, px2 + 6, py2 + 44);
        ctx.fillText(`last:${lp.dir||'-'} amt:${(lp.amount||0).toFixed(4)} scaled:${(lp.scaled||0).toFixed(4)}`, px2 + 6, py2 + 62);
        ctx.fillText(`oscPhase:${(greyline._oscPhase||0).toFixed(2)} persist:${(greyline.persist||0).toFixed(2)}`, px2 + 6, py2 + 80);
        ctx.restore();
    }
    
    // ── LEVEL / RANK DISPLAY (top-left) ──
    drawRankDisplay(s, visibleTop);
    
    // ── GOLD DISPLAY (top-right, below psych stats) ──
    drawGoldDisplay(W, s, visibleTop);
    
    // ── SKILL POINTS NOTIFICATION ──
    if (progression.skillPoints > 0) {
        const pulseA = 0.5 + Math.sin(TIME.elapsed * 3) * 0.3;
        ctx.globalAlpha = pulseA;
        ctx.font = `bold ${Math.round(13 * s)}px Georgia, serif`;
        ctx.fillStyle = 'rgba(240,210,140,0.9)';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        ctx.fillText(`${progression.skillPoints} INSIGHT POINT${progression.skillPoints > 1 ? 'S' : ''} — PRESS [P]`, W / 2, xpBarY - Math.round(12 * s));
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }
    
    
    // Subtle HUD interference when extremes/volatility rise
    if ((uiK.warn ?? 0) > 0.10) {
        ctx.save();
        ctx.setTransform(1,0,0,1,0,0);
        ctx.globalAlpha = (uiK.warn ?? 0) * 0.06;
        ctx.fillStyle = '#000';
        const lines = Math.floor(8 + (uiK.warn ?? 0) * 22);
        for (let i = 0; i < lines; i++) {
            const y = Math.random() * H;
            ctx.fillRect(0, y, W, 1);
        }
        ctx.restore();
    }
ctx.restore();
}

// ── HUD CONTAINER BORDER — Subtle dark-fantasy panel framing ──
function drawHudContainerBorder(x, y, w, h, s, side) {
    ctx.save();
    
    // Outer glow / shadow
    const grad = ctx.createLinearGradient(
        side === 'left' ? x : x + w, y,
        side === 'left' ? x + w : x, y
    );
    grad.addColorStop(0, 'rgba(80,65,45,0.08)');
    grad.addColorStop(0.7, 'rgba(40,35,25,0.03)');
    grad.addColorStop(1, 'rgba(20,18,14,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4 * s);
    ctx.fill();
    
    // Border lines — thin ornamental
    ctx.strokeStyle = 'rgba(100,85,60,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (side === 'left') {
        ctx.moveTo(x + 4 * s, y + 2 * s);
        ctx.lineTo(x + w - 4 * s, y + 2 * s);
        ctx.moveTo(x + w - 2 * s, y + 4 * s);
        ctx.lineTo(x + w - 2 * s, y + h - 4 * s);
    } else {
        ctx.moveTo(x + 4 * s, y + 2 * s);
        ctx.lineTo(x + w - 4 * s, y + 2 * s);
        ctx.moveTo(x + 2 * s, y + 4 * s);
        ctx.lineTo(x + 2 * s, y + h - 4 * s);
    }
    ctx.stroke();
    
    // Accent line at top
    ctx.strokeStyle = 'rgba(140,115,75,0.12)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 8 * s, y);
    ctx.lineTo(x + w - 8 * s, y);
    ctx.stroke();
    
    // Corner accents
    const cs = 6 * s;
    ctx.strokeStyle = 'rgba(120,100,65,0.15)';
    ctx.lineWidth = 1;
    // Top-left corner
    ctx.beginPath();
    ctx.moveTo(x, y + cs); ctx.lineTo(x, y); ctx.lineTo(x + cs, y);
    ctx.stroke();
    // Top-right corner
    ctx.beginPath();
    ctx.moveTo(x + w - cs, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cs);
    ctx.stroke();
    
    ctx.restore();
}

// ── GOLD DISPLAY — HUD top-right below psych stats ──
function drawGoldDisplay(W, s, visibleTop) {
    const goldImg = loadedImages.iconGoldCoin;
    const baseX = W - Math.round(20 * s);
    const baseY = visibleTop + Math.round(160 * s);
    const iconSize = Math.round(18 * s);
    
    // Draw gold coin icon
    if (goldImg) {
        ctx.drawImage(goldImg, baseX - Math.round(80 * s), baseY - iconSize + 4 * s, iconSize, iconSize);
    }
    
    // Gold text
    ctx.font = `bold ${Math.round(13 * s)}px Georgia, serif`;
    ctx.fillStyle = 'rgba(220,195,120,0.8)';
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 3;
    ctx.fillText(`${economy.gold}`, baseX - Math.round(80 * s) + iconSize + 4 * s, baseY);
    
    ctx.font = `${Math.round(9 * s)}px Georgia, serif`;
    ctx.fillStyle = 'rgba(180,160,110,0.45)';
    ctx.fillText('GOLD', baseX - Math.round(80 * s) + iconSize + 4 * s, baseY + Math.round(13 * s));
    ctx.shadowBlur = 0;
}

function drawResourceOrb(x, y, size, imageKey, fillPct, fillColor, label, current, max) {
    const img = loadedImages[imageKey];
    const cx = x + size / 2;
    const cy = y + size / 2;
    
    // Dark backing circle
    ctx.fillStyle = 'rgba(5,4,3,0.6)';
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.48, 0, Math.PI * 2);
    ctx.fill();
    
    // Fill level indicator — clip to circle, draw from bottom
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.42, 0, Math.PI * 2);
    ctx.clip();
    const fillH = size * fillPct;
    const fillY = y + size - fillH;
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, fillY, size, fillH);
    ctx.restore();
    
    // Draw orb image on top
    if (img) {
        ctx.drawImage(img, x, y, size, size);
    }
    
    // Overlay dim effect when low
    if (fillPct < 0.3) {
        ctx.fillStyle = `rgba(0,0,0,${(0.3 - fillPct) * 0.8})`;
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.48, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Label to the right
    ctx.font = `${Math.round(size * 0.16)}px Georgia, serif`;
    ctx.fillStyle = 'rgba(180,160,130,0.6)';
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 3;
    ctx.fillText(label, x + size + 6, cy - 2);
    
    // Value text
    ctx.font = `bold ${Math.round(size * 0.2)}px Georgia, serif`;
    ctx.fillStyle = fillPct < 0.3 ? 'rgba(200,100,80,0.85)' : 'rgba(200,185,155,0.75)';
    ctx.fillText(`${Math.ceil(current)}/${Math.ceil(max)}`, x + size + 6, cy + Math.round(size * 0.18));
    ctx.shadowBlur = 0;
}

function drawSkillSlot(x, y, size, skillData, currentCd, maxCd, usage, upgradeLevel, s) {
    const frameImg = loadedImages.uiSkillFrame;
    const iconImg = loadedImages[skillData.imageKey];
    const cx = x + size / 2;
    const cy = y + size / 2;
    const innerSize = size * 0.72;
    const innerX = cx - innerSize / 2;
    const innerY = cy - innerSize / 2;
    
    // Background
    ctx.fillStyle = 'rgba(8,6,5,0.8)';
    ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
    
    // Skill icon
    if (iconImg) {
        // Desaturate if on cooldown
        if (currentCd > 0) {
            ctx.globalAlpha = 0.35;
        } else if (usage > 3) {
            ctx.globalAlpha = 0.4;
        } else {
            // Breathing pulse when ready
            const breath = Math.sin(TIME.elapsed * 1.5 + SKILL_DATA.indexOf(skillData) * 0.8) * 0.08;
            ctx.globalAlpha = 0.85 + breath;
        }
        ctx.drawImage(iconImg, innerX, innerY, innerSize, innerSize);
        ctx.globalAlpha = 1;
    }
    
    // Cooldown sweep overlay
    if (currentCd > 0 && maxCd > 0) {
        const cdWarp = (greyline?.knobs?.ui?.cooldownWarp ?? 0);
        const warpedCd = Math.max(0, Math.min(maxCd, currentCd * (1 + cdWarp)));
        const cdPct = warpedCd / maxCd;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        // Draw pie slice from top, clockwise
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + cdPct * Math.PI * 2;
        ctx.arc(cx, cy, size * 0.42, startAngle, endAngle, false);
        ctx.closePath();
        ctx.fill();
        
        // Cooldown timer text
        ctx.font = `bold ${Math.round(size * 0.28)}px Georgia, serif`;
        ctx.fillStyle = 'rgba(200,180,140,0.7)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 3;
        ctx.fillText(warpedCd.toFixed(1), cx, cy);
        ctx.shadowBlur = 0;
        ctx.textBaseline = 'alphabetic';
    }
    
    // Frame image
    if (frameImg) {
        ctx.drawImage(frameImg, x - 2, y - 2, size + 4, size + 4);
    }
    
    // Usage strain border glow
    if (usage > 1.5 && currentCd <= 0) {
        const strainAlpha = Math.min(0.6, (usage - 1.5) * 0.2);
        ctx.strokeStyle = usage > 3 ? `rgba(140,60,40,${strainAlpha})` : `rgba(180,140,80,${strainAlpha})`;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
    }
    
    // Upgrade pips
    if (upgradeLevel > 0) {
        const pipY = y + size + 3;
        const pipSpacing = 6 * s;
        const pipStartX = cx - (upgradeLevel - 1) * pipSpacing / 2;
        for (let p = 0; p < upgradeLevel; p++) {
            ctx.fillStyle = 'rgba(220,190,120,0.8)';
            ctx.beginPath();
            ctx.arc(pipStartX + p * pipSpacing, pipY, 2 * s, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Hotkey label
    ctx.font = `${Math.round(8 * s)}px Georgia, serif`;
    ctx.fillStyle = 'rgba(160,140,110,0.45)';
    ctx.textAlign = 'center';
    ctx.fillText(skillData.hotkey, cx, y + size + Math.round(12 * s) + (upgradeLevel > 0 ? 5 * s : 0));
}

function drawGreylineBar(x, y, w, h, s) {
    const barImg = loadedImages.uiGreylineBar;
    const dist = greyline.getDistance();
    const side = greyline.getSide();
    const uiK = greyline.knobs?.ui || {};
    const alpha = Math.max(0, Math.min(1, uiK.greylineAlpha ?? 1.0));
    if (alpha <= 0.02 && (greyline.samTier||0) === 0) {
        // In flux, the bar retreats—no constant self-monitoring.
        return;
    }
    
    // Background
    if (barImg) {
        ctx.globalAlpha = 0.85;
        ctx.drawImage(barImg, x - w * 0.08, y - h * 0.6, w * 1.16, h * 2.2);
        ctx.globalAlpha = 1;
    } else {
        ctx.fillStyle = 'rgba(20,18,15,0.8)';
        ctx.fillRect(x, y, w, h);
    }
    
    // Labels
    ctx.font = `${Math.round(7 * s)}px Georgia, serif`;
    ctx.fillStyle = 'rgba(140,120,95,0.5)';
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 2;
    ctx.fillText('RESTRAINT', x + 4, y - 3);
    ctx.textAlign = 'right';
    ctx.fillText('COMPULSION', x + w - 4, y - 3);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(180,155,125,0.5)';
    ctx.fillText('GREYLINE', x + w / 2, y - 3);
    ctx.shadowBlur = 0;
    
    // Fracture line inside bar
    const lineY = y + h / 2;
    ctx.strokeStyle = `rgba(100,85,70,${0.2 + dist * 0.3})`;
    ctx.lineWidth = 0.5 + dist * 2;
    ctx.beginPath();
    ctx.moveTo(x + 6, lineY);
    for (let i = 1; i <= 20; i++) {
        const px = x + 6 + ((w - 12) * i / 20);
        const jitter = dist > 0.2 ? (Math.sin(TIME.elapsed * 4 + i * 0.8) + Math.random() - 0.5) * dist * 3 : 0;
        ctx.lineTo(px, lineY + jitter);
    }
    ctx.stroke();
    
    // Indicator pip
    const pipX = x + 6 + (w - 12) * greyline.value;
    const pipH = h * 0.7;
    // Glow
    ctx.fillStyle = `rgba(200,180,140,${0.3 + Math.sin(TIME.elapsed * 2) * 0.1})`;
    ctx.beginPath();
    ctx.arc(pipX, lineY, 6 * s, 0, Math.PI * 2);
    ctx.fill();
    // Pip
    ctx.fillStyle = 'rgba(220,200,160,0.85)';
    ctx.fillRect(pipX - 2 * s, y + (h - pipH) / 2, 4 * s, pipH);
    
    // Center marker
    const centerX = x + w / 2;
    ctx.strokeStyle = 'rgba(120,105,85,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX, y + 2);
    ctx.lineTo(centerX, y + h - 2);
    ctx.stroke();
}

function drawXpBar(x, y, w, h, s) {
    const barImg = loadedImages.uiXpBar;
    const pct = progression.getXpPercent();
    
    // Background
    ctx.fillStyle = 'rgba(10,8,6,0.7)';
    const r = h / 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
    
    // Fill
    if (pct > 0) {
        const fillW = Math.max(h, w * pct);
        const grad = ctx.createLinearGradient(x, y, x + fillW, y);
        grad.addColorStop(0, 'rgba(180,150,60,0.5)');
        grad.addColorStop(1, 'rgba(220,180,80,0.7)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, fillW, h, r);
        ctx.fill();
    }
    
    // Frame image overlay
    if (barImg) {
        ctx.globalAlpha = 0.7;
        ctx.drawImage(barImg, x - 8, y - h * 0.8, w + 16, h * 2.6);
        ctx.globalAlpha = 1;
    }
    
    // Level text
    ctx.font = `bold ${Math.round(9 * s)}px Georgia, serif`;
    ctx.fillStyle = 'rgba(220,195,150,0.8)';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 2;
    ctx.fillText(`LV ${progression.level}`, x + w / 2, y + h / 2 + 3 * s);
    ctx.shadowBlur = 0;
    
    // XP numbers
    ctx.font = `${Math.round(7 * s)}px Georgia, serif`;
    ctx.fillStyle = 'rgba(180,160,120,0.5)';
    ctx.textAlign = 'right';
    ctx.fillText(`${progression.insightCurrent}/${progression.insightToNext}`, x + w - 4, y - 2);
}

function drawPsychStats(W, s, visibleTop) {
    const statList = [
        { stat: psychStats.agency,       label: 'AGENCY',       key: 'agency' },
        { stat: psychStats.awareness,    label: 'AWARENESS',    key: 'awareness' },
        { stat: psychStats.precision,    label: 'PRECISION',    key: 'precision' },
        { stat: psychStats.adaptability, label: 'ADAPTABILITY', key: 'adaptability' },
        { stat: psychStats.integrity,    label: 'INTEGRITY',    key: 'integrity' },
        { stat: psychStats.burden,       label: 'BURDEN',       key: 'burden' },
    ];
    
    const baseX = W - Math.round(22 * s);
    const baseY = visibleTop + Math.round(28 * s);
    const lineH = Math.round(22 * s);
    const barW = Math.round(70 * s);
    const barH = Math.round(4 * s);
    
    for (let i = 0; i < statList.length; i++) {
        const { stat, label, key } = statList[i];
        const py = baseY + i * lineH;
        const status = psychStats.getStatus(key);
        
        // Text color based on status
        let textColor, barColor;
        if (status === 'degraded') {
            textColor = 'rgba(220,90,70,0.9)';
            barColor = 'rgba(200,70,50,0.7)';
        } else if (status === 'strained') {
            textColor = 'rgba(220,160,90,0.85)';
            barColor = 'rgba(200,140,60,0.6)';
        } else {
            textColor = 'rgba(200,180,150,0.8)';
            barColor = 'rgba(160,145,120,0.55)';
        }
        
        // Stat label
        ctx.font = `${Math.round(11 * s)}px Georgia, serif`;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'right';
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 4;
        ctx.fillText(label, baseX - barW - 8, py + 4);
        ctx.shadowBlur = 0;
        
        // Mini bar background
        ctx.fillStyle = 'rgba(30,25,20,0.65)';
        ctx.fillRect(baseX - barW, py, barW, barH);
        
        // Mini bar fill
        ctx.fillStyle = barColor;
        ctx.fillRect(baseX - barW, py, barW * stat.value, barH);
        
        // Value percentage
        ctx.font = `${Math.round(9 * s)}px Georgia, serif`;
        ctx.fillStyle = 'rgba(160,140,110,0.55)';
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.round(stat.value * 100)}`, baseX + 2, py + 4);
    }
}

function drawRankDisplay(s, visibleTop) {
    const x = Math.round(22 * s);
    const y = visibleTop + Math.round(24 * s);
    
    ctx.font = `${Math.round(10 * s)}px Georgia, serif`;
    ctx.fillStyle = 'rgba(160,140,110,0.55)';
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 3;
    ctx.fillText('HUSK HUNTER', x, y);
    
    ctx.font = `bold ${Math.round(18 * s)}px Georgia, serif`;
    ctx.fillStyle = 'rgba(210,190,150,0.85)';
    ctx.fillText(`RANK ${progression.level}`, x, y + Math.round(20 * s));
    
    // Kill count
    ctx.font = `${Math.round(10 * s)}px Georgia, serif`;
    ctx.fillStyle = 'rgba(140,120,95,0.5)';
    ctx.fillText(`${progression.killCount} dispatched`, x, y + Math.round(36 * s));
    ctx.shadowBlur = 0;
}

function renderAtmosphericFog(cam) {
    const t = TIME.elapsed;
    // base haze density (1 = full, can be lowered for visibility)
    let haz = greyline.knobs?.env?.hazDensity ?? 1.0;
    // make fog even fainter by default to reduce overlapping darkness
    haz *= 0.4;
    const hazeEdge = greyline.knobs?.vfx?.hazeEdge ?? 0.25;
    const samTier = greyline.samTier ?? 0;

    // colors used for fog gradients (lighter neutral grey)
    const fogColor0 = 'rgba(100,100,100,';   // inner color
    const fogColor1 = 'rgba(80,80,80,';     // mid color
    // adjust for restraint/compulsion prior to calculating visibility
    try {
        if (greyline.getSide() === 'restraint') {
            const res = greyline.getExtremity();
            haz *= 1 + Math.pow(res, 2) * 0.9;      // gentler swell
            haz = Math.min(haz, 2.5);              // cap
            // at extreme restraint we want the world to look dull but not pitch black,
            // so tone down the fog density even if the knob would otherwise swell it
            if (res > 0.8) haz *= 0.3;
        }
    } catch(e) {}
    // Visibility rule: haze should *read* at all times, then swell with extremity (increased visibility)
    let vis = 0.85 + haz * 0.45 + hazeEdge * 0.55 + samTier * 0.18;
    // reduce fog when extreme compulsion
    try {
        if (greyline.getSide() === 'compulsion') {
            const comp = greyline.getExtremity();
            vis *= 1 - Math.min(1, comp * 0.9);
        }
    } catch(e) {}
    // if fog very dense, render simple full-screen overlay and exit early
    try {
        if (greyline.getSide() === 'restraint' && greyline.getExtremity() > 0.5) {
            ctx.save();
            ctx.globalAlpha = Math.min(0.7, vis * 0.2);
            ctx.fillStyle = 'rgba(50,40,30,1)';
            ctx.fillRect(0,0,canvas.width,canvas.height);
            ctx.restore();
            return;
        }
    } catch(e) {}
    
    for (const fog of throttleArray(world.fogParticles)) {
        // Drift slowly — more organic movement (speed itself is tinted by perceived time)
        const timeScale = greyline.knobs?.timeScale ?? 1.0;
        fog.x = fog.baseX + Math.sin(t * fog.speed * timeScale + fog.phase) * fog.size * 1.2;
        fog.y = fog.baseY + Math.cos(t * fog.speed * 0.7 * timeScale + fog.phase * 1.3) * fog.size * 0.6;

        const pos = worldToScreen(fog.x, fog.y);
        const sx = pos.x + cam.x;
        const sy = pos.y + cam.y;

        const _cvw = canvas.width / camera.zoom, _cvh = canvas.height / camera.zoom;
        if (sx < -220 || sx > _cvw + 220 || sy < -220 || sy > _cvh + 220) continue;

        // larger screen radius for better readability and slightly brighter tint
        const screenR = fog.size * TILE_W * (0.5 + haz * 0.18);
        const pulse = Math.sin(t * (0.22 + haz * 0.12 + samTier * 0.08) + fog.phase) * (0.04 + hazeEdge * 0.035);
        // stronger alpha with a sane floor so small values still render
        const alpha = Math.max(0.03, ((fog.opacity * 1.5) + pulse) * vis * 0.7);

        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, screenR);
        // cooler grey tone
        grad.addColorStop(0, fogColor0 + alpha + ')');
        grad.addColorStop(0.4, fogColor1 + (alpha * 0.7) + ')');
        grad.addColorStop(1, 'rgba(18,15,12,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(sx, sy, screenR, screenR * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    {
        // if restraint high, only draw a few particles to save performance
        let iter = throttleArray(world.fogParticles);
        try {
            if (greyline.getSide() === 'restraint' && greyline.getExtremity() > 0.6) {
                iter = iter.slice(0, 8);
            }
        } catch(e) {}
        for (const fog of iter) {
        // Drift slowly — more organic movement (speed itself is tinted by perceived time)
        const timeScale = greyline.knobs?.timeScale ?? 1.0;
        fog.x = fog.baseX + Math.sin(t * fog.speed * timeScale + fog.phase) * fog.size * 1.2;
        fog.y = fog.baseY + Math.cos(t * fog.speed * 0.7 * timeScale + fog.phase * 1.3) * fog.size * 0.6;

        const pos = worldToScreen(fog.x, fog.y);
        const sx = pos.x + cam.x;
        const sy = pos.y + cam.y;

        const _cvw = canvas.width / camera.zoom, _cvh = canvas.height / camera.zoom;
        if (sx < -220 || sx > _cvw + 220 || sy < -220 || sy > _cvh + 220) continue;

        // larger screen radius for better readability and slightly brighter tint
        const screenR = fog.size * TILE_W * (0.5 + haz * 0.18);
        const pulse = Math.sin(t * (0.22 + haz * 0.12 + samTier * 0.08) + fog.phase) * (0.04 + hazeEdge * 0.035);
        // stronger alpha with a sane floor so small values still render
        const alpha = Math.max(0.03, ((fog.opacity * 1.5) + pulse) * vis * 0.7);

        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, screenR);
        // cooler grey tone
        grad.addColorStop(0, fogColor0 + alpha + ')');
        grad.addColorStop(0.4, fogColor1 + (alpha * 0.7) + ')');
        grad.addColorStop(1, 'rgba(18,15,12,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(sx, sy, screenR, screenR * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}
}

function renderAmbientParticles(cam) {
    const t = TIME.elapsed;
    const vw = canvas.width / camera.zoom;
    const vh = canvas.height / camera.zoom;
    
    // ── DRIFTING DEAD LEAVES ──
    for (const leaf of throttleArray(world.ambientLeaves)) {
        // Update leaf position — wind-driven drift with flutter
        const windGust = Math.sin(t * 0.3 + leaf.phase) * 0.3;
        leaf.x += (leaf.vx + windGust) * 0.016;
        leaf.y += (leaf.vy + Math.sin(t * leaf.flutter + leaf.phase) * 0.15) * 0.016;
        leaf.rot += leaf.rotSpeed * 0.016;
        
        // Wrap around world
        if (leaf.x > WORLD_SIZE + 2) leaf.x = -2;
        if (leaf.x < -2) leaf.x = WORLD_SIZE + 2;
        if (leaf.y > WORLD_SIZE + 2) leaf.y = -2;
        if (leaf.y < -2) leaf.y = WORLD_SIZE + 2;
        
        const pos = worldToScreen(leaf.x, leaf.y);
        const sx = pos.x + cam.x;
        const sy = pos.y + cam.y;
        
        if (sx < -20 || sx > vw + 20 || sy < -20 || sy > vh + 20) continue;
        
        // Draw leaf — small rotated oval
        const flutter = Math.sin(t * leaf.flutter * 2 + leaf.phase) * 0.3;
        ctx.globalAlpha = leaf.opacity + flutter * 0.1;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(leaf.rot);
        ctx.fillStyle = leaf.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, leaf.size * 1.5, leaf.size * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        // Leaf vein
        ctx.strokeStyle = `rgba(100,70,40,${leaf.opacity * 0.5})`;
        ctx.lineWidth = 0.3;
        ctx.beginPath();
        ctx.moveTo(-leaf.size, 0);
        ctx.lineTo(leaf.size, 0);
        ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1;
    }
    
    // ── FLOATING DUST MOTES ──
    for (const dust of throttleArray(world.ambientDust)) {
        // Gentle wandering
        dust.x += Math.sin(t * dust.speed * 4 + dust.phase) * dust.drift * 0.016;
        dust.y += Math.cos(t * dust.speed * 3 + dust.phase * 1.3) * dust.drift * 0.5 * 0.016;
        
        const pos = worldToScreen(dust.x, dust.y);
        const sx = pos.x + cam.x;
        const sy = pos.y + cam.y;
        
        if (sx < -10 || sx > vw + 10 || sy < -10 || sy > vh + 10) continue;
        
        // Pulsing opacity
        const pulse = Math.sin(t * 0.8 + dust.phase) * 0.08;
        ctx.globalAlpha = dust.opacity + pulse;
        ctx.fillStyle = `rgba(180,160,130,${dust.opacity + pulse})`;
        ctx.beginPath();
        ctx.arc(sx, sy - 10, dust.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

function renderTerrain(cam) {
    // Convert all 4 screen corners to world-space to find the full visible tile range
    // Account for camera zoom — visible area is smaller when zoomed in
    const vw = canvas.width / camera.zoom;
    const vh = canvas.height / camera.zoom;
    const corners = [
        screenToWorld(-cam.x, -cam.y),
        screenToWorld(-cam.x + vw, -cam.y),
        screenToWorld(-cam.x, -cam.y + vh),
        screenToWorld(-cam.x + vw, -cam.y + vh),
    ];
    
    let minWX = Infinity, maxWX = -Infinity, minWY = Infinity, maxWY = -Infinity;
    for (const c of corners) {
        if (c.x < minWX) minWX = c.x;
        if (c.x > maxWX) maxWX = c.x;
        if (c.y < minWY) minWY = c.y;
        if (c.y > maxWY) maxWY = c.y;
    }
    
    // Generous padding to ensure no gaps
    const pad = 4;
    const startX = Math.max(0, Math.floor(minWX) - pad);
    const startY = Math.max(0, Math.floor(minWY) - pad);
    const endX = Math.min(WORLD_SIZE, Math.ceil(maxWX) + pad);
    const endY = Math.min(WORLD_SIZE, Math.ceil(maxWY) + pad);
    
    const useTextures = groundDirtPattern && groundHubPattern;
    
    // if performance is poor, skip every other tile row/column to reduce load
    const step = tileStep;
    for (let x = startX; x < endX; x += step) {
        for (let y = startY; y < endY; y += step) {
            if (!world.tiles[x] || !world.tiles[x][y]) continue;
            const tile = world.tiles[x][y];
            const pos = worldToScreen(x, y);
            const sx = pos.x + cam.x;
            const sy = pos.y + cam.y;
            
            // Broad screen culling (generous, account for zoom)
            const vw2 = canvas.width / camera.zoom;
            const vh2 = canvas.height / camera.zoom;
            if (sx < -TILE_W * 2 || sx > vw2 + TILE_W * 2 || 
                sy < -TILE_H * 2 || sy > vh2 + TILE_H * 2) continue;
            
            const s = tile.shade;
            const v = tile.variation;
            const isHub = tile.type === 'hub_stone' || tile.type === 'hub_edge';
            const isHaze = tile.type === 'haze';
            
            // Draw slightly oversized diamond to prevent subpixel gaps (extra padding for zoom)
            const hw = TILE_W / 2 + 1.5;
            const hh = TILE_H / 2 + 1.5;
            
            if (isHaze) {
                const ha = Math.min(1, tile.hazeAmount);
                const r = Math.floor(18 + (1 - ha) * 20);
                const g = Math.floor(16 + (1 - ha) * 16);
                const b = Math.floor(14 + (1 - ha) * 12);
                const a = 0.5 + ha * 0.5;
                ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
                ctx.beginPath();
                ctx.moveTo(sx, sy - hh);
                ctx.lineTo(sx + hw, sy);
                ctx.lineTo(sx, sy + hh);
                ctx.lineTo(sx - hw, sy);
                ctx.closePath();
                ctx.fill();
            } else if (useTextures) {
                // Textured tile rendering — use pre-clipped diamond canvases
                // Choose appropriate ground pattern for the tile type
                let pattern;
                switch (tile.type) {
                    case 'hub_stone':
                    case 'hub_edge':
                        pattern = groundHubPattern;
                        break;
                    case 'road':
                        pattern = groundRoadPattern || groundDirtPattern;
                        break;
                    case 'asphalt':
                        pattern = groundAsphaltPattern || groundDirtPattern;
                        break;
                    case 'concrete':
                        pattern = groundConcretePattern || groundDirtPattern;
                        break;
                    default:
                        pattern = groundDirtPattern;
                }
                // Apply shade variation via globalAlpha and color overlay
                ctx.globalAlpha = 0.75 + s * 0.25;
                ctx.drawImage(pattern, 
                    sx - pattern.width / 2, 
                    sy - pattern.height / 2);
                ctx.globalAlpha = 1;
                
                // Color overlay for tile type variation
                let overlayR, overlayG, overlayB, overlayA;
                switch (tile.type) {
                    case 'hub_stone':
                        overlayR = 55; overlayG = 45; overlayB = 35; overlayA = 0.08 + v * 0.04;
                        break;
                    case 'hub_edge':
                        overlayR = 40; overlayG = 36; overlayB = 30; overlayA = 0.1;
                        break;
                    case 'deadgrass':
                        overlayR = 35; overlayG = 40; overlayB = 28; overlayA = 0.08 + v * 0.06;
                        break;
                    case 'path':
                        overlayR = 50; overlayG = 42; overlayB = 35; overlayA = 0.06;
                        break;
                    case 'road':
                        overlayR = 48; overlayG = 48; overlayB = 50; overlayA = 0.05 + v * 0.03;
                        break;
                    case 'asphalt':
                        overlayR = 36; overlayG = 36; overlayB = 38; overlayA = 0.06 + v * 0.03;
                        break;
                    case 'concrete':
                        overlayR = 58; overlayG = 58; overlayB = 60; overlayA = 0.04 + v * 0.02;
                        break;
                    default: // dirt
                        overlayR = 38; overlayG = 32; overlayB = 26; overlayA = 0.03 + v * 0.03;
                }
                ctx.fillStyle = `rgba(${overlayR},${overlayG},${overlayB},${overlayA})`;
                ctx.beginPath();
                ctx.moveTo(sx, sy - hh);
                ctx.lineTo(sx + hw, sy);
                ctx.lineTo(sx, sy + hh);
                ctx.lineTo(sx - hw, sy);
                ctx.closePath();
                ctx.fill();
            } else {
                // Fallback: solid color diamonds (improved colors)
                let r, g, b;
                switch (tile.type) {
                    case 'hub_stone':
                        r = Math.floor((52 + v * 10) * s);
                        g = Math.floor((44 + v * 8) * s);
                        b = Math.floor((36 + v * 6) * s);
                        break;
                    case 'hub_edge':
                        r = Math.floor((46 + v * 8) * s);
                        g = Math.floor((40 + v * 6) * s);
                        b = Math.floor((32 + v * 5) * s);
                        break;
                    case 'deadgrass':
                        r = Math.floor((42 + v * 8) * s);
                        g = Math.floor((44 + v * 10) * s);
                        b = Math.floor((30 + v * 5) * s);
                        break;
                    case 'path':
                        r = Math.floor((50 + v * 8) * s);
                        g = Math.floor((42 + v * 6) * s);
                        b = Math.floor((36 + v * 5) * s);
                        break;
                    default: // dirt
                        r = Math.floor((42 + v * 10) * s);
                        g = Math.floor((36 + v * 8) * s);
                        b = Math.floor((28 + v * 5) * s);
                }
                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.beginPath();
                ctx.moveTo(sx, sy - hh);
                ctx.lineTo(sx + hw, sy);
                ctx.lineTo(sx, sy + hh);
                ctx.lineTo(sx - hw, sy);
                ctx.closePath();
                ctx.fill();
            }
        }
    }
    
    // Campfire glow on ground — warm amber pool
    if (world.campfire) {
        const cfPos = worldToScreen(world.campfire.x, world.campfire.y);
        const cfx = cfPos.x + cam.x;
        const cfy = cfPos.y + cam.y;
        
        const flickerR = 60 + Math.sin(TIME.elapsed * 3) * 8 + Math.sin(TIME.elapsed * 7.3) * 4;
        const grad = ctx.createRadialGradient(cfx, cfy, 0, cfx, cfy, flickerR);
        const flickerA = 0.06 + Math.sin(TIME.elapsed * 4) * 0.015;
        grad.addColorStop(0, `rgba(120,80,30,${flickerA})`);
        grad.addColorStop(0.4, `rgba(80,50,20,${flickerA * 0.5})`);
        grad.addColorStop(1, 'rgba(60,35,15,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(cfx, cfy, flickerR, flickerR * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawStructure(ctx, sx, sy, s) {
    // G1.8 governed House A path: physical PNG is 2048, but it occupies the
    // frozen 512x512 logical projection canvas. Draw by canonical ground anchor.
    if (s.type === 'governedHouseA') {
        const img = loadedImages[s.asset];
        if (!img) return;

        const g = s.governedSprite;
        const w = g.logicalWidth;
        const h = g.logicalHeight;

        ctx.save();
        ctx.translate(sx, sy);
        ctx.drawImage(
            img,
            -g.anchorPixelX,
            -g.anchorPixelY,
            w,
            h
        );

        if (s.governedTest) {
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(230,210,170,0.9)';
            ctx.fillText(s.label || '[G1.8 HOUSE TEST]', 0, 20);
        }
        ctx.restore();
        return;
    }

    // Use sprite-based rendering for hub buildings
    const isChapel = s.type === 'chapel';
    // Allow per-structure override (house1..house3) for shacks
    const img = isChapel ? loadedImages.hubChapel : (s.asset && loadedImages[s.asset]) ? loadedImages[s.asset] : loadedImages.hubDwelling;
    
    if (img) {
        let scale = isChapel ? 1.4 : 0.9 + (s.w + s.h) * 0.06;
        // If this structure uses a house asset, render it ~1.5× larger as requested
        if (s.asset && String(s.asset).startsWith('house')) scale *= 1.5;
        const h = (isChapel ? 160 : 110) * scale;
        const w = h * (img.width / img.height);
        
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(sx, sy + 4, w * 0.45, h * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw building sprite
        ctx.save();
        ctx.translate(sx, sy);
        ctx.drawImage(img, -w / 2, -h + h * 0.15, w, h);
        ctx.restore();
        
        // Warm lantern glow
        const t = TIME.elapsed;
        const flickA = 0.08 + Math.sin(t * 2 + sx) * 0.03;
        const glowR = (isChapel ? 40 : 25) + Math.sin(t * 3) * 3;
        const grad = ctx.createRadialGradient(sx, sy - h * 0.3, 0, sx, sy - h * 0.3, glowR);
        grad.addColorStop(0, `rgba(140,90,30,${flickA})`);
        grad.addColorStop(0.5, `rgba(100,60,15,${flickA * 0.4})`);
        grad.addColorStop(1, 'rgba(60,35,10,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(sx, sy - h * 0.3, glowR, 0, Math.PI * 2);
        ctx.fill();
    } else {
        // Fallback procedural
        const w = s.w * TILE_W * 0.4;
        const wallH = 40 + (isChapel ? 20 : 0);
        
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(sx, sy + 5, w * 0.6, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = isChapel ? '#1a1816' : '#171513';
        ctx.fillRect(sx - w / 2, sy - wallH, w, wallH);
        
        ctx.fillStyle = '#0f0d0b';
        ctx.beginPath();
        ctx.moveTo(sx - w / 2 - 5, sy - wallH);
        ctx.lineTo(sx, sy - wallH - 20);
        ctx.lineTo(sx + w / 2 + 5, sy - wallH);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#0a0908';
        ctx.fillRect(sx - 5, sy - 15, 10, 15);
    }
}

function drawFence(ctx, sx, sy, f) {
    ctx.strokeStyle = 'rgba(50,40,30,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx + f.lean * 5, sy);
    ctx.lineTo(sx + f.lean * 10, sy - 15 * f.height);
    ctx.stroke();
}

function drawTree(ctx, sx, sy, t) {
    // Trunk
    ctx.strokeStyle = 'rgba(40,30,25,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx + t.lean * 20, sy - 25 * t.height, sx + t.lean * 30, sy - 50 * t.height);
    ctx.stroke();
    
    if (!t.bare) {
        // Sparse, tired foliage
        ctx.fillStyle = 'rgba(30,35,25,0.4)';
        ctx.beginPath();
        ctx.ellipse(sx + t.lean * 30, sy - 50 * t.height, 15, 10, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Branches — thin, reaching
    ctx.strokeStyle = 'rgba(35,28,22,0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
        const by = sy - 25 * t.height - i * 8;
        ctx.beginPath();
        ctx.moveTo(sx + t.lean * 15, by);
        ctx.lineTo(sx + t.lean * 15 + (i % 2 ? 15 : -15), by - 10);
        ctx.stroke();
    }
}

function drawProp(ctx, sx, sy, p) {
    const img = loadedImages[p.type];
    if (!img) return;
    
    const scale = p.scale || 0.5;
    // Size depends on prop type
    let baseH;
    switch(p.type) {
        case 'deadTree1': baseH = 180; break;
        case 'deadTree2': baseH = 190; break;
        case 'brokenFence': baseH = 65; break;
        case 'collapsedBarn': baseH = 140; break;
        case 'stoneRuin': baseH = 100; break;
        case 'groundRocks': baseH = 50; break;
        case 'oldWell': baseH = 110; break;
        case 'woodenCart': baseH = 80; break;
        case 'graveMarkers': baseH = 85; break;
        case 'deadBush': baseH = 55; break;
        case 'oldSignpost': baseH = 100; break;
        case 'hayPile': baseH = 75; break;
        case 'skullPile': baseH = 50; break;
        case 'lanternPost': baseH = 120; break;
        default: baseH = 90;
    }
    
    const h = baseH * scale;
    const w = h * (img.width / img.height);
    
    // Shadow beneath
    const shadowW = w * 0.6;
    const shadowH = h * 0.12;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 2, shadowW, shadowH, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw sprite
    ctx.save();
    ctx.translate(sx, sy);
    if (p.flip) ctx.scale(-1, 1);
    // Subtle sway for trees
    if (p.type === 'deadTree1' || p.type === 'deadTree2') {
        const sway = Math.sin(TIME.elapsed * 0.3 + p.x * 0.5) * 0.015;
        ctx.rotate(sway);
    }
    ctx.globalAlpha = 0.9;
    ctx.drawImage(img, -w / 2, -h + (p.zOffset ? h * 0.05 : 0), w, h);
    ctx.globalAlpha = 1;
    ctx.restore();
    
    // Lantern post warm glow effect
    if (p.type === 'lanternPost') {
        const t = TIME.elapsed;
        const flickA = 0.1 + Math.sin(t * 3 + p.x * 2) * 0.03;
        const glowR = 30 + Math.sin(t * 4 + p.y) * 4;
        const grad = ctx.createRadialGradient(sx, sy - h * 0.45, 0, sx, sy - h * 0.45, glowR);
        grad.addColorStop(0, `rgba(160,110,40,${flickA})`);
        grad.addColorStop(0.5, `rgba(120,70,20,${flickA * 0.4})`);
        grad.addColorStop(1, 'rgba(80,45,10,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(sx, sy - h * 0.45, glowR, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawCampfire(ctx, sx, sy) {
    // Campfire — the heart of the Holdfast
    // Flickering light, warmth, the only real color in the world
    
    // Ground scorch mark
    ctx.fillStyle = 'rgba(20,15,10,0.3)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 3, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Log base
    ctx.fillStyle = '#1a1210';
    ctx.fillRect(sx - 7, sy - 2, 14, 5);
    ctx.fillRect(sx - 5, sy - 3, 3, 7);
    ctx.fillRect(sx + 2, sy - 4, 3, 8);
    
    // Fire glow — layered
    const t = TIME.elapsed;
    const f1 = Math.sin(t * 5) * 0.15 + 0.85;
    const f2 = Math.sin(t * 7.3 + 1) * 0.1 + 0.9;
    const f3 = Math.sin(t * 3.7 + 2) * 0.2 + 0.8;
    
    // Outer warm glow
    const grad = ctx.createRadialGradient(sx, sy - 8, 0, sx, sy - 8, 25 * f1);
    grad.addColorStop(0, `rgba(180,110,30,${0.15 * f2})`);
    grad.addColorStop(0.5, `rgba(120,60,15,${0.06 * f2})`);
    grad.addColorStop(1, 'rgba(80,40,10,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy - 8, 25, 0, Math.PI * 2);
    ctx.fill();
    
    // Core flames — multiple overlapping
    for (let i = 0; i < 3; i++) {
        const fx = sx + Math.sin(t * (4 + i) + i * 2) * 2;
        const fy = sy - 5 - i * 3;
        const fh = (8 + i * 3) * [f1, f2, f3][i];
        
        const colors = [
            `rgba(220,160,40,${0.6 * f1})`,
            `rgba(200,100,20,${0.4 * f2})`,
            `rgba(160,60,10,${0.3 * f3})`
        ];
        
        ctx.fillStyle = colors[i];
        ctx.beginPath();
        ctx.moveTo(fx - 3 + i, fy);
        ctx.quadraticCurveTo(fx - 1, fy - fh * 0.7, fx, fy - fh);
        ctx.quadraticCurveTo(fx + 1, fy - fh * 0.7, fx + 3 - i, fy);
        ctx.closePath();
        ctx.fill();
    }
    
    // Ember sparks
    if (Math.random() < 0.08) {
        particles.push({
            x: world.campfire.x + (Math.random() - 0.5) * 0.3,
            y: world.campfire.y + (Math.random() - 0.5) * 0.3,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -1.5 - Math.random() * 2,
            type: 'campfire_ember',
            timer: 0.5 + Math.random() * 0.8,
            size: 1 + Math.random() * 1.5
        });
    }
}

// ============================================================
// WALL SEGMENT — Stone perimeter around the Holdfast
// ============================================================
function drawWall(ctx, sx, sy, w) {
    const wallH = 28 * w.height;
    const wallW = 12;
    const dmg = w.damage;
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 3, wallW * 0.6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Follow the projected neighbour: the old fixed-width rectangles read as black posts.
    const face=wallFace(w,worldToScreen);
    ctx.beginPath();
    face.forEach((p,i)=>i===0?ctx.moveTo(sx+p.x,sy+p.y):ctx.lineTo(sx+p.x,sy+p.y));
    ctx.closePath();
    ctx.fillStyle = '#514b40';
    ctx.fill();
    ctx.strokeStyle = '#302d27';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // Cap and mortar courses follow the same perspective, never screen-aligned pillars.
    ctx.strokeStyle = '#827866';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sx+face[3].x,sy+face[3].y);
    ctx.lineTo(sx+face[2].x,sy+face[2].y);
    ctx.stroke();
    ctx.strokeStyle = '#37332c';
    ctx.lineWidth = 0.7;
    for(let course=1;course<5;course++) {
        const t=course/5;
        ctx.beginPath();
        ctx.moveTo(sx,sy+face[3].y*t);
        ctx.lineTo(sx+face[1].x,sy+face[1].y+(face[2].y-face[1].y)*t);
        ctx.stroke();
    }

    // Damage cracks
    if (dmg > 0.1) {
        ctx.strokeStyle = `rgba(15,12,10,${dmg * 0.6})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(sx - 2, sy - wallH * 0.3);
        ctx.lineTo(sx + 1, sy - wallH * 0.6);
        ctx.lineTo(sx - 1, sy - wallH * 0.8);
        ctx.stroke();
    }
    
    // Torch
    if (w.hasTorch) {
        const flickerH = 5 + Math.sin(TIME.elapsed * 8 + w.angle) * 2;
        const flickerA = 0.5 + Math.sin(TIME.elapsed * 6 + w.angle * 3) * 0.2;
        // Glow
        const grad = ctx.createRadialGradient(sx, sy - wallH - 4, 0, sx, sy - wallH - 4, 25);
        grad.addColorStop(0, `rgba(120,80,30,${flickerA * 0.12})`);
        grad.addColorStop(1, 'rgba(80,50,20,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(sx, sy - wallH - 4, 25, 0, Math.PI * 2);
        ctx.fill();
        // Flame
        ctx.fillStyle = `rgba(180,120,40,${flickerA})`;
        ctx.beginPath();
        ctx.moveTo(sx - 2, sy - wallH);
        ctx.quadraticCurveTo(sx, sy - wallH - flickerH, sx + 2, sy - wallH);
        ctx.closePath();
        ctx.fill();
    }
}

// ============================================================
// GATE — Exit from the Holdfast
// ============================================================
function drawGate(ctx, sx, sy, gate) {
    // Left pillar
    const lPos = worldToScreen(gate.leftPillar.x, gate.leftPillar.y);
    const rPos = worldToScreen(gate.rightPillar.x, gate.rightPillar.y);
    const cam = camera.getOffset();
    const lx = lPos.x + cam.x, ly = lPos.y + cam.y;
    const rx = rPos.x + cam.x, ry = rPos.y + cam.y;
    
    // Taller pillars flanking the gate
    const pH = 42;
    for (const [px, py] of [[lx, ly], [rx, ry]]) {
        ctx.fillStyle = '#1e1a16';
        ctx.fillRect(px - 7, py - pH, 14, pH);
        // Cap
        ctx.fillStyle = '#252018';
        ctx.fillRect(px - 8, py - pH - 4, 16, 5);
        // Torch on each pillar
        const fh = 6 + Math.sin(TIME.elapsed * 7) * 2;
        const fa = 0.6 + Math.sin(TIME.elapsed * 5) * 0.2;
        const grad = ctx.createRadialGradient(px, py - pH - 6, 0, px, py - pH - 6, 30);
        grad.addColorStop(0, `rgba(140,90,30,${fa * 0.15})`);
        grad.addColorStop(1, 'rgba(80,50,20,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py - pH - 6, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(200,130,40,${fa})`;
        ctx.beginPath();
        ctx.moveTo(px - 2, py - pH);
        ctx.quadraticCurveTo(px, py - pH - fh, px + 2, py - pH);
        ctx.closePath();
        ctx.fill();
    }
    
    // "THE VERGE" text above gate when player is near
    const hubX = WORLD_SIZE / 2, hubY = WORLD_SIZE / 2;
    const playerDist = Math.sqrt((player.x - gate.x)**2 + (player.y - gate.y)**2);
    if (playerDist < 6) {
        const alpha = Math.max(0, 1 - playerDist / 6) * 0.5;
        ctx.fillStyle = `rgba(180,155,120,${alpha})`;
        ctx.font = '8px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText('THE VERGE', (lx + rx) / 2, Math.min(ly, ry) - pH - 12);
    }
}

// ============================================================
// NPC — Hub characters with dialogue
// ============================================================
let activeDialogue = null;
let nearestNPC = null;

function drawNPC(ctx, sx, sy, npc) {
    // Idle animation — gentle breathing, slight sway
    const breathe = Math.sin(TIME.elapsed * 1.8 + npc.x * 3) * 0.8;
    const sway = Math.sin(TIME.elapsed * 0.7 + npc.y * 2) * 0.015;
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 2, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    
    const img = npc.spriteKey ? loadedImages[npc.spriteKey] : null;
    
    if (img) {
        // Sprite-based NPC rendering with bottom 5% crop (green circle artifact removal)
        const spriteH = actorHeight('npc', npc.heightM);
        const spriteW = spriteH * (img.width / img.height);
        const cropBottom = Math.floor(img.height * 0.05);
        const srcH = img.height - cropBottom;
        
        ctx.save();
        ctx.translate(sx, sy + breathe);
        ctx.rotate(sway);
        if (npc.facing < 0) ctx.scale(-1, 1);
        
        // 9-arg drawImage: crop bottom 5% of source
        ctx.drawImage(img,
            0, 0, img.width, srcH,                      // source rect (cropped)
            -spriteW / 2, -spriteH + 5, spriteW, spriteH // dest rect
        );
        
        ctx.restore();
    } else {
        // Fallback procedural NPC
        ctx.save();
        ctx.translate(sx, sy + breathe);
        ctx.rotate(sway);
        ctx.fillStyle = npc.color;
        ctx.fillRect(-5, -18, 4, 18);
        ctx.fillRect(1, -18, 4, 18);
        ctx.fillRect(-7, -38, 14, 22);
        ctx.fillRect(-9, -38, 18, 4);
        ctx.beginPath();
        ctx.arc(0, -44, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = npc.accent;
        ctx.fillRect(-8, -28, 16, 2);
        const blink = Math.sin(TIME.elapsed * 0.3 + npc.x) > 0.97;
        if (!blink) {
            ctx.fillStyle = 'rgba(180,150,100,0.5)';
            ctx.fillRect(-3, -46, 2, 1.5);
            ctx.fillRect(1, -46, 2, 1.5);
        }
        ctx.restore();
    }
    
    // Name label when player is nearby
    const dist = Math.sqrt((player.x - npc.x)**2 + (player.y - npc.y)**2);
    if (dist < 3) {
        const alpha = Math.max(0, 1 - dist / 3) * 0.7;
        ctx.fillStyle = `rgba(200,175,140,${alpha})`;
        ctx.font = '9px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText(npc.name, sx, sy - 62 + breathe);
    }
}

function drawReclaimZone(ctx, sx, sy, z) {
    const t = z.timer > 1 ? 1 : z.timer; // fade out last second
    const radiusTiles = Math.max(0, z.radius || 0);
    const r = radiusTiles * TILE_W * 0.4;
    if (r <= 0.5) return; // nothing visible — defensive early exit
    const age = z.age;
    
    // Ground distortion — cracked earth
    ctx.globalAlpha = t * 0.2;
    ctx.fillStyle = '#1a2018';
    ctx.beginPath();
    ctx.ellipse(sx, sy, r, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Growing root/crack lines from center
    if (age > 0.5) {
        ctx.strokeStyle = `rgba(45,55,30,${t * 0.3})`;
        ctx.lineWidth = 1;
        const crackCount = Math.min(8, Math.floor(age * 2));
        for (let i = 0; i < crackCount; i++) {
            const angle = (i / crackCount) * Math.PI * 2 + Math.sin(age + i) * 0.2;
            const len = Math.min(r, age * 6 + i * 3);
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            const mx = sx + Math.cos(angle) * len * 0.5;
            const my = sy + Math.sin(angle) * len * 0.2;
            ctx.quadraticCurveTo(mx + Math.sin(i) * 3, my, 
                sx + Math.cos(angle) * len, sy + Math.sin(angle) * len * 0.4);
            ctx.stroke();
        }
    }
    
    // Fungus/rot spots after maturation
    if (age > 2) {
        ctx.fillStyle = `rgba(50,60,35,${t * 0.25})`;
        const spotCount = Math.min(6, Math.floor((age - 2) * 1.5));
        for (let i = 0; i < spotCount; i++) {
            const sa = (i / spotCount) * Math.PI * 2 + z.pulse * 0.3;
            const sr = r * (0.3 + Math.sin(i * 2.3) * 0.2);
            ctx.beginPath();
            ctx.arc(sx + Math.cos(sa) * sr, sy + Math.sin(sa) * sr * 0.4, 
                    2 + Math.sin(age + i) * 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Unstable zone jitter (compulsion)
    if (z.unstable) {
        ctx.strokeStyle = `rgba(60,40,25,${t * 0.15 + Math.sin(TIME.elapsed * 6) * 0.05})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        const jitterR = Math.max(0.5, r + Math.sin(TIME.elapsed * 7) * 3);
        ctx.ellipse(sx + Math.sin(TIME.elapsed * 4) * 2, sy, jitterR, jitterR * 0.4, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    // Edge boundary ring
    ctx.strokeStyle = `rgba(40,50,30,${t * 0.15})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.ellipse(sx, sy, r, r * 0.4, 0, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.globalAlpha = 1;
}

function drawSnare(ctx, sx, sy, s) {
    const eff = s.effectiveness || 1;
    const alpha = s.triggered ? 0.15 * eff : (0.3 + Math.sin(s.pulse) * 0.08) * eff;
    ctx.strokeStyle = `rgba(100,80,120,${alpha})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(sx, sy, s.radius * TILE_W * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    
    // Sigil marks — dimmer when effectiveness is low
    ctx.fillStyle = `rgba(80,60,100,${alpha * 0.4})`;
    for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + TIME.elapsed;
        const r = s.radius * TILE_W * 0.2;
        ctx.fillRect(sx + Math.cos(a) * r - 1, sy + Math.sin(a) * r - 1, 2, 2);
    }
    
    // Weakening indicator — cracks in the sigil when effectiveness drops
    if (eff < 0.7) {
        ctx.strokeStyle = `rgba(60,40,40,${(1 - eff) * 0.2})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(sx - 4, sy - 2);
        ctx.lineTo(sx + 3, sy + 1);
        ctx.stroke();
    }
}

function drawPlayer(ctx, sx, sy) {
    const img = loadedImages.aliza;
    const side = greyline.getSide();
    const extr = greyline.getExtremity();
    const T = TIME.elapsed;
    const dir = player.facingDir; // 0=N,1=NE,2=E,3=SE,4=S,5=SW,6=W,7=NW
    
    // ── 8-DIRECTIONAL LEAN & OFFSET ──
    // With real directional sprites, lean/scale are subtle polish — not the main direction cue
    const dirLeanMap = [0, 0.02, 0.03, 0.02, 0, -0.02, -0.03, -0.02]; // subtle lean per direction
    const dirBobXMap = [0, 0.6, 1.0, 0.6, 0, -0.6, -1.0, -0.6]; // lateral shift per direction
    
    // ── RICH MOVEMENT ANIMATION ──
    let bobY = 0, bobX = 0;
    let bobSpeed = 8, bobAmp = 2;
    let armSwing = 0, headTilt = 0, footPhase = 0;
    
    if (player.state === 'moving') {
        if (side === 'compulsion') { bobSpeed = 12; bobAmp = 3.5; }
        else if (side === 'restraint') { bobSpeed = 5.5; bobAmp = 1.2; }
        else { bobSpeed = 8; bobAmp = 2.2; }
        footPhase = T * bobSpeed;
        bobY = Math.abs(Math.sin(footPhase)) * bobAmp;
        bobX = Math.sin(footPhase * 0.5) * 0.8 + dirBobXMap[dir] * 0.6;
        armSwing = Math.sin(footPhase) * 0.08;
        headTilt = Math.sin(footPhase * 0.5) * 0.02;
    } else if (player.state === 'idle') {
        const breathRate = side === 'compulsion' ? 3.5 : side === 'restraint' ? 1.2 : 2;
        bobY = Math.sin(T * breathRate) * 0.8;
        bobX = Math.sin(T * 0.4) * 0.3;
        headTilt = Math.sin(T * 0.6) * 0.008;
    }
    
    const dashAlpha = player.state === 'dashing' ? 0.5 : 1.0;
    
    // ── DYNAMIC SHADOW ──
    const shadowStretchX = player.state === 'dashing' ? 22 : player.state === 'moving' ? 17 + Math.abs(Math.sin(footPhase)) * 3 : 16;
    const shadowStretchY = player.state === 'dashing' ? 4 : 6;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(sx + bobX, sy + 2, shadowStretchX, shadowStretchY, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Invulnerability flash
    if (player.invulnTimer > 0 && Math.floor(T * 20) % 2 === 0) return;
    
    // ── SHADOW ACKNOWLEDGEMENT AURA ──
    if (player.shadowActive) {
        const shadowIntensity = greyline.isBalanced() ? 0.2 : (side === 'compulsion' ? 0.3 + Math.random() * 0.1 : 0.12);
        ctx.fillStyle = `rgba(40,15,60,${shadowIntensity + Math.sin(T * 5) * 0.06})`;
        ctx.beginPath();
        ctx.ellipse(sx, sy - 20, 28 + Math.sin(T * 3) * 4, 22, 0, 0, Math.PI * 2);
        ctx.fill();
        if (side === 'compulsion' && extr > 0.3) {
            ctx.strokeStyle = `rgba(80,20,100,${extr * 0.2 + Math.random() * 0.1})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.arc(sx + (Math.random() - 0.5) * 6, sy - 20, 25 + Math.random() * 8, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
    
    // Shadow denial leak
    if (!player.shadowActive && player.shadowDenialTimer > 30) {
        const leakIntensity = Math.min(0.15, (player.shadowDenialTimer - 30) * 0.003);
        ctx.fillStyle = `rgba(30,10,40,${leakIntensity + Math.sin(T * 7) * 0.03})`;
        ctx.beginPath();
        ctx.arc(sx + Math.sin(T * 2.5) * 3, sy - 25 - bobY, 8 + Math.sin(T * 4) * 3, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // ── ATTUNEMENT GLOW ──
    if (player.state === 'attune') {
        const attuneAlpha = player.attuneUseCount > 2 ? 0.15 + Math.sin(T * 6) * 0.1 : 0.25 + Math.sin(T * 2) * 0.1;
        ctx.strokeStyle = `rgba(120,110,90,${attuneAlpha})`;
        ctx.lineWidth = 0.8;
        const r = 18 + Math.sin(T * 1.5) * 4;
        ctx.beginPath();
        ctx.arc(sx, sy - 15, r, 0, Math.PI * 2);
        ctx.stroke();
        if (player.attuneUseCount <= 2) {
            ctx.strokeStyle = 'rgba(100,90,75,0.08)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.arc(sx, sy - 15, r * 3, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
    
    // ── GREYLINE VISUAL FEEDBACK ──
    if (side === 'compulsion' && extr > 0.2) {
        ctx.globalAlpha = extr * 0.08;
        ctx.fillStyle = '#4a1510';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 25 - bobY, 18, 30, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
    if (side === 'restraint' && extr > 0.2) {
        ctx.globalAlpha = extr * 0.06;
        ctx.fillStyle = '#1a2025';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 25 - bobY, 18, 30, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
    
    ctx.globalAlpha = dashAlpha;
    
    // ══════════════════════════════════════════
    // 8-DIRECTIONAL PROCEDURAL ANIMATION
    // Sprite is a single image — we use scale, lean, offset to sell direction.
    // N/S directions: narrower width (seeing from front/back).
    // E/W directions: full side profile.
    // Diagonals: intermediate.
    // Attack: full 360° directional swing toward mouse.
    // ══════════════════════════════════════════
    let scaleX = 1, scaleY = 1, lean = 0;
    let offsetX = 0, offsetY = 0; // positional offset for anticipation / follow-through
    
    // With real directional sprites, base scale is always 1.0
    const dirWidthMod = 1.0;
    
    if (player.state === 'attacking') {
        const atkDuration = 0.25;
        const raw = player.attackTimer / atkDuration;
        const t = Math.max(0, Math.min(1, raw));
        
        // Attack direction in screen space for lunge
        const atkAngle = player.attackAngle;
        const atkScreenDir = worldToScreen(Math.cos(atkAngle), Math.sin(atkAngle));
        const atkLen = Math.sqrt(atkScreenDir.x * atkScreenDir.x + atkScreenDir.y * atkScreenDir.y) || 1;
        const atkNX = atkScreenDir.x / atkLen;
        const atkNY = atkScreenDir.y / atkLen;
        
        // 3-phase: anticipation (t: 1→0.7), strike (t: 0.7→0.3), follow-through (t: 0.3→0)
        if (t > 0.7) {
            // Anticipation — pull back OPPOSITE attack direction
            const phase = (t - 0.7) / 0.3;
            offsetX = -atkNX * phase * 5;
            offsetY = -atkNY * phase * 3;
            scaleX = dirWidthMod - phase * 0.04;
            scaleY = 1 + phase * 0.03;
            lean = -atkNX * phase * 0.06;
        } else if (t > 0.3) {
            // Strike — lunge TOWARD attack direction with stretch
            const phase = (t - 0.3) / 0.4;
            const eased = 1 - Math.pow(1 - phase, 3);
            offsetX = atkNX * eased * 8;
            offsetY = atkNY * eased * 4;
            scaleX = dirWidthMod + eased * 0.12;
            scaleY = 1 - eased * 0.06;
            lean = atkNX * eased * 0.12;
        } else {
            // Follow-through — spring back
            const phase = t / 0.3;
            const bounce = Math.sin(phase * Math.PI) * 0.5;
            offsetX = atkNX * (1 - phase) * 5;
            offsetY = atkNY * (1 - phase) * 2;
            scaleX = dirWidthMod + (1 - phase) * 0.06;
            scaleY = 1 - (1 - phase) * 0.03 + bounce * 0.02;
            lean = atkNX * (1 - phase) * 0.06;
        }
    } else if (player.state === 'dashing') {
        const dashT = player.dashTimer > 0 ? player.dashTimer / 0.2 : 0;
        // Stretch along dash direction
        const dashScreenDir = worldToScreen(player.dashDirX, player.dashDirY);
        const dashLen = Math.sqrt(dashScreenDir.x ** 2 + dashScreenDir.y ** 2) || 1;
        const dashNX = dashScreenDir.x / dashLen;
        scaleX = 1.2 + dashT * 0.1;
        scaleY = 0.85 - dashT * 0.05;
        lean = dashNX * 0.12;
        offsetX = dashNX * 3;
    } else if (player.state === 'attune') {
        const breathe = Math.sin(T * 2) * 0.03;
        scaleX = dirWidthMod + breathe;
        scaleY = 1 + breathe;
        bobY -= 2;
    } else if (player.state === 'moving') {
        const cycle = Math.sin(footPhase);
        scaleX = dirWidthMod + cycle * 0.03;
        scaleY = 1 - cycle * 0.03;
        lean = dirLeanMap[dir] + headTilt + armSwing * player.facing;
    } else {
        // Idle
        const breathe = Math.sin(T * 2) * 0.015;
        const shift = Math.sin(T * 0.6) * 0.005;
        scaleX = dirWidthMod - breathe;
        scaleY = 1 + breathe;
        lean = shift;
    }
    
    // ── 8-DIRECTIONAL SPRITE SELECTION ──
    const dirSprite = ALIZA_DIR_SPRITES[dir] || ALIZA_DIR_SPRITES[4]; // fallback S
    const dirImg = loadedImages[dirSprite.key];
    let flipX = dirSprite.flip;

    // If TEST mode is enabled, prefer the custom Aliza sets (base / gun / knife) when present
    let spriteKeyToUse = dirSprite.key;
    if (TEST_ALIZA_SPRITES) {
        const ci = DIR_TO_CUSTOM_INDEX[dir] || 0;
        const baseKey = ALIZA_CUSTOM_BASE[ci];
        const gunKey = ALIZA_CUSTOM_GUN[ci];
        const knifeKey = ALIZA_CUSTOM_KNIFE[ci];

        const crouchKey = ALIZA_CUSTOM_CROUCH[ci];
        // If hiding in haze for a sustained time, prefer crouch/hide frames when available.
        // If explicit crouch image isn't present, emulate crouch using the base sprite.
        let crouchEmulate = false;
        if ((player._hideInFogTimer||0)>2.5 && !loadedImages[crouchKey]) {
            // log once per attempt so user knows the asset wasn't loaded
            if (!player._crouchAssetWarned) {
                console.warn('[HIDE] crouch sprite missing for key', crouchKey);
                player._crouchAssetWarned = true;
            }
        }
        // Immediate forced crouch (from Shift) should override hide-timer visuals
        if (player._forceCrouch) {
            if (loadedImages[crouchKey]) {
                spriteKeyToUse = crouchKey; // crouch/hide sprite
                flipX = false;
            } else if (loadedImages[baseKey]) {
                spriteKeyToUse = baseKey; // use base and emulate crouch below
                flipX = false;
                crouchEmulate = true;
            }
        } else if ((player._hideInFogTimer || 0) > 2.5) {
            if (loadedImages[crouchKey]) {
                spriteKeyToUse = crouchKey; // crouch/hide sprite
                flipX = false;
            } else if (loadedImages[baseKey]) {
                // fallback: use base sprite but apply a crouch transform later
                spriteKeyToUse = baseKey;
                flipX = false;
                crouchEmulate = true;
            }
        } else if ((player._gunSpriteTimer || 0) > 0 && loadedImages[gunKey]) {
            spriteKeyToUse = gunKey; // gun shot sprite
            flipX = false; // custom assets are already direction-specific
        } else if (player.state === 'attacking' && loadedImages[knifeKey]) {
            spriteKeyToUse = knifeKey; // melee/knife attack sprite
            flipX = false;
        } else if (loadedImages[baseKey]) {
            spriteKeyToUse = baseKey; // neutral facing sprite
            flipX = false;
        } else {
            // fall back to the directional aliza mapping
            spriteKeyToUse = dirSprite.key;
            flipX = dirSprite.flip;
        }
    }

    // Use selected sprite (custom or default) with fallback to legacy single `aliza` image
    const activeImg = loadedImages[spriteKeyToUse] || dirImg || img;

    if ((player._hideInFogTimer||0)>2.5 || player._forceCrouch) {
        ctx.save();
        ctx.fillStyle = 'rgba(240,240,240,0.9)';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('HIDDEN', sx, sy - 30);
        ctx.restore();
    }
    if (activeImg) {
        const spriteH = PLAYER_SPRITE_H; // projection-bound 1.72m standing height
        // Crop bottom 5% of source to remove green circle artifacts from bg removal
        const srcCropBottom = Math.floor(activeImg.height * 0.05);
        const srcH = activeImg.height - srcCropBottom;
        const srcW = activeImg.width;
        const spriteW = spriteH * (srcW / activeImg.height);
        const cropH = spriteH * (srcH / activeImg.height);
        
        // If we're emulating a crouch (no dedicated crouch sprite available),
        // apply a subtle squash and downward offset so the player appears lower.
        if (typeof crouchEmulate !== 'undefined' && crouchEmulate) {
            scaleY *= 0.82;
            offsetY += 6;
        }
        ctx.save();
        ctx.translate(sx + bobX + offsetX, sy - bobY + offsetY);
        if (flipX) ctx.scale(-1, 1);
        ctx.rotate(lean);
        ctx.scale(Math.abs(scaleX), scaleY);
        ctx.drawImage(activeImg, 0, 0, srcW, srcH, -spriteW / 2, -cropH + 5, spriteW, cropH);
        ctx.restore();
        
        // ══════════════════════════════════════════
        // ATTACK EFFECTS — 360° directional slash arc toward mouse
        // The slash arc radiates from the player in the attack direction
        // ══════════════════════════════════════════
        if (player.state === 'attacking') {
            const atkDuration = 0.25;
            const raw = player.attackTimer / atkDuration;
            const t = Math.max(0, Math.min(1, raw));
            if (t < 0.7 && t > 0.05) {
                const strikePhase = (0.7 - t) / 0.65;
                
                // Convert attack angle to screen-space angle for the arc
                // In isometric, world angle needs to be mapped to screen
                const aEnd = worldToScreen(
                    player.x + Math.cos(player.attackAngle),
                    player.y + Math.sin(player.attackAngle)
                );
                const aStart = worldToScreen(player.x, player.y);
                const screenAtkAngle = Math.atan2(aEnd.y - aStart.y, aEnd.x - aStart.x);
                
                const slashR = 24 + strikePhase * 14;
                const arcSpan = 1.0 + strikePhase * 0.5;
                const arcCenter = screenAtkAngle;
                const arcCenterX = sx + offsetX;
                const arcCenterY = sy - 22 - bobY + offsetY;
                
                // Primary slash arc — bright, sweeping
                ctx.strokeStyle = `rgba(210,190,155,${strikePhase * 0.75})`;
                ctx.lineWidth = 2 + strikePhase * 2.5;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.arc(arcCenterX, arcCenterY, slashR, arcCenter - arcSpan, arcCenter + arcSpan);
                ctx.stroke();
                
                // Ghost arc — trailing, dimmer
                ctx.strokeStyle = `rgba(160,140,120,${strikePhase * 0.3})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(arcCenterX, arcCenterY, slashR + 5, arcCenter - arcSpan * 0.7, arcCenter + arcSpan * 0.7);
                ctx.stroke();
                
                // Weapon tip line — extends beyond the arc
                const tipX = arcCenterX + Math.cos(arcCenter) * (slashR + 8);
                const tipY = arcCenterY + Math.sin(arcCenter) * (slashR + 8);
                const baseX = arcCenterX + Math.cos(arcCenter) * 10;
                const baseY = arcCenterY + Math.sin(arcCenter) * 10;
                ctx.strokeStyle = `rgba(220,200,170,${strikePhase * 0.5})`;
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.moveTo(baseX, baseY);
                ctx.lineTo(tipX, tipY);
                ctx.stroke();
                
                // Impact sparks at the arc edge
                if (strikePhase > 0.3 && strikePhase < 0.8) {
                    const sparkCount = 3;
                    for (let i = 0; i < sparkCount; i++) {
                        const sparkAngle = arcCenter + (Math.random() - 0.5) * arcSpan * 1.2;
                        const sparkR = slashR + Math.random() * 6;
                        const sparkX = arcCenterX + Math.cos(sparkAngle) * sparkR;
                        const sparkY = arcCenterY + Math.sin(sparkAngle) * sparkR;
                        ctx.fillStyle = `rgba(200,175,130,${strikePhase * 0.4 * Math.random()})`;
                        ctx.beginPath();
                        ctx.arc(sparkX, sparkY, 1 + Math.random() * 1.5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
                
                // Shadow attack: darker, more intense arcs
                if (player.shadowActive) {
                    ctx.strokeStyle = `rgba(80,30,100,${strikePhase * 0.35})`;
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(arcCenterX, arcCenterY, slashR - 3, arcCenter - arcSpan * 1.1, arcCenter + arcSpan * 1.1);
                    ctx.stroke();
                }
            }
        }
    } else {
        // Fallback procedural silhouette
        ctx.save();
        ctx.translate(sx + bobX + offsetX, sy - bobY + offsetY);
        if (flipX) ctx.scale(-1, 1);
        ctx.rotate(lean);
        ctx.scale(Math.abs(scaleX), scaleY);
        ctx.fillStyle = '#2a2420';
        ctx.fillRect(-8, -40, 16, 38);
        ctx.fillStyle = '#1a1614';
        ctx.fillRect(-6, -46, 12, 10);
        // Weapon indication
        const atkScreenAngle = player.state === 'attacking' ? player.attackAngle : DIR8_ANGLES[dir];
        ctx.strokeStyle = 'rgba(160,140,120,0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -25);
        ctx.lineTo(Math.cos(atkScreenAngle) * 14, -25 + Math.sin(atkScreenAngle) * 8);
        ctx.stroke();
        ctx.restore();
    }
    
    ctx.globalAlpha = 1.0;
    
    // ── DASH GHOST TRAIL — multi-frame afterimages ──
    if (player.state === 'dashing' && activeImg) {
        const _dSpriteH = PLAYER_SPRITE_H;
        const _dSrcCrop = Math.floor(activeImg.height * 0.05);
        const _dSrcH = activeImg.height - _dSrcCrop;
        const _dSpriteW = _dSpriteH * (activeImg.width / activeImg.height);
        const _dCropH = _dSpriteH * (_dSrcH / activeImg.height);
        // Convert dash direction to screen space for trail positioning
        const dScreen = worldToScreen(player.dashDirX, player.dashDirY);
        const dLen = Math.sqrt(dScreen.x ** 2 + dScreen.y ** 2) || 1;
        const dNX = dScreen.x / dLen;
        const dNY = dScreen.y / dLen;
        for (let i = 0; i < 4; i++) {
            const trailAlpha = 0.18 - i * 0.04;
            const trailDist = (i + 1) * 12;
            const trailX = sx - dNX * trailDist;
            const trailY = sy - dNY * trailDist;
            ctx.globalAlpha = trailAlpha;
            ctx.save();
            ctx.translate(trailX, trailY);
            if (flipX) ctx.scale(-1, 1);
            ctx.scale(1.1 - i * 0.03, 0.92 + i * 0.02);
            ctx.drawImage(activeImg, 0, 0, activeImg.width, _dSrcH, -_dSpriteW / 2, -_dCropH + 5, _dSpriteW, _dCropH);
            ctx.restore();
        }
        ctx.globalAlpha = 1;
    } else if (player.state === 'dashing') {
        for (let i = 0; i < 3; i++) {
            const trailAlpha = 0.15 - i * 0.04;
            ctx.fillStyle = `rgba(80,60,50,${trailAlpha})`;
            const trailX = sx - player.dashDirX * (i + 1) * 15;
            const trailY = sy - player.dashDirY * (i + 1) * 15;
            ctx.fillRect(trailX - 6, trailY - 35, 12, 32);
        }
    }
}

// Helper: draw enemy sprite with bottom 5% crop to remove green circle artifacts
function drawEnemySprite(ctx, img, dx, dy, dw, dh, enemyType) {
    if (!img) return;
    // Burdened asset has a large green platform base — crop 30% from bottom
    const cropFraction = enemyType === 'burdened' ? 0.30 : 0.05;
    const cropBottom = Math.floor(img.height * cropFraction);
    const srcH = img.height - cropBottom;
    ctx.drawImage(img, 0, 0, img.width, srcH, dx, dy, dw, dh);
}

function drawEnemy(ctx, sx, sy, e, cam) {
    const stunFlash = e.stunTimer > 0 && Math.floor(TIME.elapsed * 15) % 2;
    const bobY = e.dead ? 0 : Math.sin(e.bobPhase) * 2;
    cam = cam || { x: 0, y: 0 };
    
    const spriteH = actorHeight(e.type, e.heightM);

    const imgKey = e.type;
    const img = loadedImages[imgKey];
    let spriteW = img ? spriteH * (img.width / img.height) : 16;
    
    // ── DEATH ANIMATION RENDERING ──
    
    if (e.dead) {
        const dt = e.deathTimer;
        
        if (e.type === 'watchful') {
            // The Watchful crumbles — collapses vertically, splits, dims
            // Phase 1 (0-0.5s): flash + initial crumble, sprite compresses downward
            // Phase 2 (0.5-1.5s): sprite fragments apart, darkens
            // Phase 3 (1.5-3.5s): remains fade, only crumble chunks left
            
            const shadowAlpha = Math.max(0, 1 - dt * 0.5);
            ctx.fillStyle = `rgba(0,0,0,${0.2 * shadowAlpha})`;
            ctx.beginPath();
            ctx.ellipse(sx, sy + 2, 14 + dt * 2, 5, 0, 0, Math.PI * 2);
            ctx.fill();
            
            if (dt < 1.8) {
                const crumbleProgress = Math.min(1, dt / 1.5);
                const squash = 1 - crumbleProgress * 0.6; // compress to 40% height
                const spread = crumbleProgress * 8; // widen as it crumbles
                const spriteAlpha = Math.max(0, 1 - crumbleProgress * 0.8);
                const shake = dt < 0.5 ? (0.5 - dt) * 8 : 0;
                const shakeX = Math.sin(TIME.elapsed * 30) * shake;
                
                ctx.globalAlpha = spriteAlpha;
                
                // Tint toward dark amber as it dies
                if (crumbleProgress > 0.3) {
                    ctx.filter = `brightness(${1 - crumbleProgress * 0.6}) sepia(${crumbleProgress * 0.4})`;
                }
                
                if (img) {
                    const drawH = spriteH * squash;
                    const drawW = spriteW + spread;
                    const drawY = sy - drawH + 5;
                    drawEnemySprite(ctx, img, sx - drawW / 2 + shakeX, drawY, drawW, drawH, e.type);
                } else {
                    ctx.fillStyle = '#30281f';
                    const drawH = (spriteH - 10) * squash;
                    ctx.fillRect(sx - 8 - spread / 2 + shakeX, sy - drawH, 16 + spread, drawH);
                }
                
                ctx.filter = 'none';
                
                // Crack lines across the body during collapse
                if (crumbleProgress > 0.2) {
                    ctx.strokeStyle = `rgba(80,60,30,${(crumbleProgress - 0.2) * 0.5})`;
                    ctx.lineWidth = 1;
                    for (let i = 0; i < 3; i++) {
                        const cy = sy - spriteH * squash * (0.3 + i * 0.25);
                        ctx.beginPath();
                        ctx.moveTo(sx - 8 + shakeX, cy);
                        ctx.lineTo(sx + 8 + shakeX + (Math.random() - 0.5) * spread, cy + (Math.random() - 0.5) * 4);
                        ctx.stroke();
                    }
                }
            }
            
            ctx.globalAlpha = 1;
            return; // skip normal state-based effects for dead watchful
        }
        
        if (e.type === 'drifting') {
            // The Drifting unravels — dissolves from edges inward, rises
            // Phase 1 (0-0.8s): form flickers and begins losing coherence
            // Phase 2 (0.8-2.0s): body dissolves into motes, drifts upward  
            // Phase 3 (2.0-3.5s): only the faintest wisp remains, ascending
            
            const shadowAlpha = Math.max(0, 1 - dt * 0.8);
            ctx.fillStyle = `rgba(0,0,0,${0.15 * shadowAlpha})`;
            ctx.beginPath();
            ctx.ellipse(sx, sy + 2, 14 * shadowAlpha, 5 * shadowAlpha, 0, 0, Math.PI * 2);
            ctx.fill();
            
            if (dt < 2.2) {
                const dissolveProgress = Math.min(1, dt / 2.0);
                const riseY = dt * 12; // float upward
                const spriteAlpha = Math.max(0, 1 - dissolveProgress);
                const flicker = dt < 0.8 ? Math.sin(TIME.elapsed * 20) * 0.3 + 0.7 : 1;
                
                ctx.globalAlpha = spriteAlpha * flicker;
                
                if (img) {
                    // Draw with increasing transparency from bottom up (dissolve effect)
                    const drawY = sy - spriteH + 5 - riseY;
                    const clipH = spriteH * (1 - dissolveProgress * 0.7);
                    
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(sx - spriteW, drawY, spriteW * 2, clipH);
                    ctx.clip();
                    drawEnemySprite(ctx, img, sx - spriteW / 2, drawY, spriteW, spriteH, e.type);
                    ctx.restore();
                    
                    // Dissolving edge — a ragged shimmer line at the dissolve boundary
                    if (dissolveProgress > 0.1 && dissolveProgress < 0.9) {
                        const edgeY = drawY + clipH;
                        ctx.globalAlpha = (1 - dissolveProgress) * 0.4;
                        ctx.strokeStyle = '#5a5248';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        for (let px = sx - spriteW / 2; px < sx + spriteW / 2; px += 3) {
                            const jitter = Math.sin(px * 0.5 + TIME.elapsed * 5) * 3;
                            if (px === sx - Math.floor(spriteW / 2)) {
                                ctx.moveTo(px, edgeY + jitter);
                            } else {
                                ctx.lineTo(px, edgeY + jitter);
                            }
                        }
                        ctx.stroke();
                    }
                } else {
                    ctx.fillStyle = 'rgba(35,30,28,0.6)';
                    const drawH = (spriteH - 10) * (1 - dissolveProgress * 0.7);
                    ctx.fillRect(sx - 8, sy - drawH - riseY, 16, drawH);
                }
            }
            
            ctx.globalAlpha = 1;
            return; // skip normal state-based effects for dead drifting
        }
        
        // ── LINGERING DEATH — just stops. Quiet. Anticlimactic. ──
        if (e.type === 'lingering') {
            // Phase 1 (0-0.8s): freezes, trembles, slight flicker
            // Phase 2 (0.8-2.0s): slowly fades, sinks slightly
            // Phase 3 (2.0-3.5s): nearly gone, ground stain remains
            
            const shadowAlpha = Math.max(0, 1 - dt * 0.4);
            ctx.fillStyle = `rgba(0,0,0,${0.15 * shadowAlpha})`;
            ctx.beginPath();
            ctx.ellipse(sx, sy + 2, 14 * shadowAlpha, 5 * shadowAlpha, 0, 0, Math.PI * 2);
            ctx.fill();
            
            if (dt < 2.5) {
                const fadeProgress = Math.min(1, dt / 2.0);
                const spriteAlpha = Math.max(0, 1 - fadeProgress * 0.9);
                const sinkY = fadeProgress * 4;
                // Trembling stops gradually
                const tremble = dt < 0.8 ? (0.8 - dt) * 4 : 0;
                const shakeX = Math.sin(TIME.elapsed * 25) * tremble;
                
                ctx.globalAlpha = spriteAlpha;
                
                // Desaturation as life leaves
                if (fadeProgress > 0.2) {
                    ctx.filter = `brightness(${1 - fadeProgress * 0.5}) saturate(${1 - fadeProgress * 0.6})`;
                }
                
                if (img) {
                    drawEnemySprite(ctx, img, sx - spriteW / 2 + shakeX, sy - spriteH + 5 + sinkY, spriteW, spriteH, e.type);
                } else {
                    ctx.fillStyle = '#2a2825';
                    ctx.fillRect(sx - 8 + shakeX, sy - spriteH + 8 + sinkY, 16, spriteH - 10);
                }
                
                ctx.filter = 'none';
            }
            
            ctx.globalAlpha = 1;
            return;
        }
        
        // ── HUDDLED DEATH — collapses inward, reaching toward group ──
        if (e.type === 'huddled') {
            // Phase 1 (0-0.5s): sudden contraction, the body pulls inward
            // Phase 2 (0.5-1.5s): tilts toward nearest ally, reaches
            // Phase 3 (1.5-3.0s): folds down into the ground, darkens
            
            const shadowAlpha = Math.max(0, 1 - dt * 0.5);
            ctx.fillStyle = `rgba(0,0,0,${0.18 * shadowAlpha})`;
            ctx.beginPath();
            ctx.ellipse(sx, sy + 2, 12 * shadowAlpha, 4 * shadowAlpha, 0, 0, Math.PI * 2);
            ctx.fill();
            
            if (dt < 2.5) {
                const collapseProgress = Math.min(1, dt / 2.0);
                const spriteAlpha = Math.max(0, 1 - collapseProgress);
                const squish = 1 - collapseProgress * 0.5;
                const contract = 1 - collapseProgress * 0.3;
                const tiltToward = Math.sin(Math.min(dt, 1) * Math.PI * 0.5) * 0.2 * e.facing;
                
                ctx.globalAlpha = spriteAlpha;
                
                if (collapseProgress > 0.3) {
                    ctx.filter = `brightness(${1 - collapseProgress * 0.4})`;
                }
                
                if (img) {
                    ctx.save();
                    ctx.translate(sx, sy);
                    ctx.rotate(tiltToward);
                    ctx.scale(contract, squish);
                    drawEnemySprite(ctx, img, -spriteW / 2, -spriteH + 5, spriteW, spriteH, e.type);
                    ctx.restore();
                } else {
                    ctx.fillStyle = '#252320';
                    const drawH = (spriteH - 10) * squish;
                    ctx.fillRect(sx - 8 * contract, sy - drawH, 16 * contract, drawH);
                }
                
                ctx.filter = 'none';
            }
            
            ctx.globalAlpha = 1;
            return;
        }
        
        // ── REHEARSED DEATH — freezes mid-pattern, then shatters ──
        if (e.type === 'rehearsed') {
            // Phase 1 (0-0.6s): frozen in last pose, vibrating, pattern lines appear on surface
            // Phase 2 (0.6-1.5s): cracks propagate, body splits along pattern seams
            // Phase 3 (1.5-3.5s): fragments separate, each piece fading
            
            const shadowAlpha = Math.max(0, 1 - dt * 0.4);
            ctx.fillStyle = `rgba(0,0,0,${0.18 * shadowAlpha})`;
            ctx.beginPath();
            ctx.ellipse(sx, sy + 2, 14 * shadowAlpha, 5, 0, 0, Math.PI * 2);
            ctx.fill();
            
            if (dt < 2.0) {
                const shatterProgress = Math.min(1, dt / 1.8);
                const spriteAlpha = Math.max(0, 1 - shatterProgress);
                const vibrate = dt < 0.6 ? (0.6 - dt) * 6 : 0;
                const shakeX = Math.sin(TIME.elapsed * 30) * vibrate;
                const shakeY = Math.cos(TIME.elapsed * 25) * vibrate * 0.5;
                // Pieces separate
                const splitX = shatterProgress > 0.4 ? (shatterProgress - 0.4) * 15 : 0;
                
                ctx.globalAlpha = spriteAlpha;
                
                if (img) {
                    if (shatterProgress > 0.4) {
                        // Draw as two halves splitting apart
                        const halfW = spriteW / 2;
                        ctx.save();
                        ctx.beginPath();
                        ctx.rect(sx - spriteW / 2 - splitX + shakeX, sy - spriteH + 5 + shakeY, halfW, spriteH);
                        ctx.clip();
                        drawEnemySprite(ctx, img, sx - spriteW / 2 - splitX + shakeX, sy - spriteH + 5 + shakeY, spriteW, spriteH, e.type);
                        ctx.restore();
                        
                        ctx.save();
                        ctx.beginPath();
                        ctx.rect(sx + shakeX + splitX, sy - spriteH + 5 - shakeY, halfW, spriteH);
                        ctx.clip();
                        drawEnemySprite(ctx, img, sx - spriteW / 2 + splitX + shakeX, sy - spriteH + 5 - shakeY, spriteW, spriteH, e.type);
                        ctx.restore();
                    } else {
                        drawEnemySprite(ctx, img, sx - spriteW / 2 + shakeX, sy - spriteH + 5 + shakeY, spriteW, spriteH, e.type);
                    }
                    
                    // Crack lines across the body
                    if (shatterProgress > 0.1) {
                        ctx.strokeStyle = `rgba(160,130,60,${(shatterProgress - 0.1) * 0.5})`;
                        ctx.lineWidth = 1;
                        for (let i = 0; i < 4; i++) {
                            const cy = sy - spriteH * (0.2 + i * 0.2);
                            ctx.beginPath();
                            ctx.moveTo(sx - 10 + shakeX, cy + (Math.sin(i * 2.3) * 3));
                            ctx.lineTo(sx + 10 + shakeX, cy - (Math.cos(i * 1.7) * 3));
                            ctx.stroke();
                        }
                    }
                } else {
                    ctx.fillStyle = '#28241e';
                    ctx.fillRect(sx - 8 + shakeX - splitX, sy - spriteH + 8, 8, spriteH - 10);
                    ctx.fillRect(sx + shakeX + splitX, sy - spriteH + 8, 8, spriteH - 10);
                }
                
                ctx.filter = 'none';
            }
            
            ctx.globalAlpha = 1;
            return;
        }
        
        // ── BURDENED DEATH — the weight finally drops, ground impact ──
        if (e.type === 'burdened') {
            // Phase 1 (0-0.3s): body straightens, burden lifts off shoulders
            // Phase 2 (0.3-1.0s): collapses downward hard, ground impact
            // Phase 3 (1.0-3.5s): body flattens, weight presses into earth
            
            const shadowAlpha = Math.max(0, 1 - dt * 0.3);
            const impactSpread = dt > 0.3 ? Math.min(1, (dt - 0.3) * 2) : 0;
            ctx.fillStyle = `rgba(0,0,0,${0.25 * shadowAlpha})`;
            ctx.beginPath();
            ctx.ellipse(sx, sy + 2, 16 + impactSpread * 8, 6 + impactSpread * 2, 0, 0, Math.PI * 2);
            ctx.fill();
            
            if (dt < 2.5) {
                const collapseProgress = Math.min(1, dt / 2.0);
                const spriteAlpha = Math.max(0, 1 - collapseProgress * 0.8);
                // Phase 1: slight lift, then slam
                const lift = dt < 0.3 ? Math.sin(dt / 0.3 * Math.PI) * -5 : 0;
                // Phase 2: compress and widen
                const squash = dt > 0.3 ? Math.max(0.3, 1 - (dt - 0.3) * 0.7) : 1;
                const spread = dt > 0.3 ? Math.min(1, (dt - 0.3) * 1.5) : 0;
                
                ctx.globalAlpha = spriteAlpha;
                
                if (collapseProgress > 0.2) {
                    ctx.filter = `brightness(${1 - collapseProgress * 0.5})`;
                }
                
                if (img) {
                    const drawH = spriteH * squash;
                    const drawW = spriteW * (1 + spread * 0.3);
                    drawEnemySprite(ctx, img, sx - drawW / 2, sy - drawH + 5 + lift, drawW, drawH, e.type);
                } else {
                    ctx.fillStyle = '#1e1a16';
                    const drawH = (spriteH - 10) * squash;
                    ctx.fillRect(sx - 8 * (1 + spread * 0.3), sy - drawH + lift, 16 * (1 + spread * 0.3), drawH);
                }
                
                ctx.filter = 'none';
                
                // Impact crack lines appearing at moment of collapse
                if (dt > 0.3 && dt < 2.0) {
                    const crackAlpha = Math.min(0.3, (dt - 0.3) * 0.4) * (1 - collapseProgress);
                    ctx.strokeStyle = `rgba(20,16,10,${crackAlpha})`;
                    ctx.lineWidth = 1.5;
                    for (let i = 0; i < 5; i++) {
                        const angle = (i / 5) * Math.PI * 2 + 0.3;
                        const len = 6 + spread * 10;
                        ctx.beginPath();
                        ctx.moveTo(sx, sy + 2);
                        ctx.lineTo(sx + Math.cos(angle) * len, sy + 2 + Math.sin(angle) * len * 0.4);
                        ctx.stroke();
                    }
                }
            }
            
            ctx.globalAlpha = 1;
            return;
        }
        
        // ── DEFERRED DEATH — final release, pressure venting upward ──
        if (e.type === 'deferred') {
            // Phase 1 (0-0.5s): body cracks open, amber light spills out
            // Phase 2 (0.5-1.5s): collapses as pressure escapes upward
            // Phase 3 (1.5-3.5s): empty shell remains, slowly fading
            
            const shadowAlpha = Math.max(0, 1 - dt * 0.4);
            ctx.fillStyle = `rgba(0,0,0,${0.15 * shadowAlpha})`;
            ctx.beginPath();
            ctx.ellipse(sx, sy + 2, 12 * shadowAlpha, 4 * shadowAlpha, 0, 0, Math.PI * 2);
            ctx.fill();
            
            if (dt < 2.5) {
                const releaseProgress = Math.min(1, dt / 2.0);
                const spriteAlpha = Math.max(0, 1 - releaseProgress);
                const crack = dt < 0.5 ? dt / 0.5 : 1;
                const deflate = dt > 0.5 ? Math.min(1, (dt - 0.5) * 0.8) : 0;
                
                ctx.globalAlpha = spriteAlpha;
                
                // Amber light spilling from cracks
                if (crack > 0.2 && dt < 1.5) {
                    const glowAlpha = (1 - releaseProgress) * crack * 0.4;
                    const grad = ctx.createRadialGradient(sx, sy - spriteH / 2, 0, sx, sy - spriteH / 2, spriteH * 0.6);
                    grad.addColorStop(0, `rgba(180,140,50,${glowAlpha})`);
                    grad.addColorStop(1, 'rgba(120,90,30,0)');
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(sx, sy - spriteH / 2, spriteH * 0.6, 0, Math.PI * 2);
                    ctx.fill();
                }
                
                if (img) {
                    const drawH = spriteH * (1 - deflate * 0.4);
                    const drawW = spriteW * (1 - deflate * 0.15);
                    drawEnemySprite(ctx, img, sx - drawW / 2, sy - drawH + 5, drawW, drawH, e.type);
                } else {
                    ctx.fillStyle = '#201c18';
                    const drawH = (spriteH - 10) * (1 - deflate * 0.4);
                    ctx.fillRect(sx - 6, sy - drawH, 12, drawH);
                }
                
                // Crack lines
                if (crack > 0.3) {
                    ctx.strokeStyle = `rgba(160,120,40,${(1 - releaseProgress) * crack * 0.4})`;
                    ctx.lineWidth = 1;
                    for (let i = 0; i < 3; i++) {
                        const cy = sy - spriteH * (0.3 + i * 0.2) * (1 - deflate * 0.4);
                        ctx.beginPath();
                        ctx.moveTo(sx - 6, cy + Math.sin(i * 3) * 2);
                        ctx.lineTo(sx + 6, cy - Math.cos(i * 2) * 2);
                        ctx.stroke();
                    }
                }
            }
            
            ctx.globalAlpha = 1;
            return;
        }
        
        // ── REMEMBERED DEATH — dies like the player might ──
        if (e.type === 'remembered') {
            // Phase 1 (0-0.6s): flinches, tries to dash away — mirror of player damage
            // Phase 2 (0.6-1.5s): form destabilizes, flickers between player silhouette and its own
            // Phase 3 (1.5-3.5s): dissolves into echo fragments, fading ghost
            
            const shadowAlpha = Math.max(0, 1 - dt * 0.5);
            ctx.fillStyle = `rgba(0,0,0,${0.15 * shadowAlpha})`;
            ctx.beginPath();
            ctx.ellipse(sx, sy + 2, 14 * shadowAlpha, 5 * shadowAlpha, 0, 0, Math.PI * 2);
            ctx.fill();
            
            if (dt < 2.5) {
                const dissolveProgress = Math.min(1, dt / 2.0);
                const spriteAlpha = Math.max(0, 1 - dissolveProgress);
                // Flinch back then reach forward
                const flinchX = dt < 0.3 ? Math.sin(dt / 0.3 * Math.PI) * 5 * e.facing : 0;
                const flicker = dt > 0.6 && dt < 1.5 ? Math.sin(TIME.elapsed * 18) * 0.3 + 0.7 : 1;
                const riseY = dt > 1.0 ? (dt - 1.0) * 6 : 0;
                
                ctx.globalAlpha = spriteAlpha * flicker;
                
                // Ghostly blue-grey tint as it dies
                if (dissolveProgress > 0.3) {
                    ctx.filter = `brightness(${1 - dissolveProgress * 0.3}) saturate(${1 - dissolveProgress * 0.5}) hue-rotate(${dissolveProgress * 15}deg)`;
                }
                
                if (img) {
                    // Mirror effect — slight duplicate offset
                    if (dt > 0.6 && dt < 1.8 && flicker > 0.8) {
                        ctx.globalAlpha = spriteAlpha * 0.15;
                        drawEnemySprite(ctx, img, sx - spriteW / 2 + flinchX + 3, sy - spriteH + 5 - riseY - 2, spriteW, spriteH, e.type);
                        ctx.globalAlpha = spriteAlpha * flicker;
                    }
                    
                    drawEnemySprite(ctx, img, sx - spriteW / 2 + flinchX, sy - spriteH + 5 - riseY, spriteW, spriteH, e.type);
                } else {
                    ctx.fillStyle = '#2c2822';
                    ctx.fillRect(sx - 8 + flinchX, sy - spriteH + 8 - riseY, 16, spriteH - 10);
                }
                
                ctx.filter = 'none';
            }
            
            ctx.globalAlpha = 1;
            return;
        }
        
        // ── GENERIC DEATH FALLBACK ──
        const alpha = Math.max(0, 1 - dt);
        ctx.globalAlpha = alpha;
        
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(sx, sy + 2, 14, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        
        if (img) {
            drawEnemySprite(ctx, img, sx - spriteW / 2, sy - spriteH + 5, spriteW, spriteH, e.type);
        } else {
            ctx.fillStyle = '#252220';
            ctx.fillRect(sx - 8, sy - spriteH + 8, 16, spriteH - 10);
        }
        
        ctx.globalAlpha = 1;
        return;
    }
    
    // ── LIVING ENEMY RENDERING ──
    
    ctx.globalAlpha = 1;
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 2, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    
    if (stunFlash) {
        ctx.filter = 'brightness(2)';
    }
    
    // Low health visual — tint/darken for Watchful and Drifting
    let lowHealthFilter = '';
    if (e.type === 'watchful' && e.health < e.maxHealth * 0.3) {
        const flicker = Math.sin(TIME.elapsed * 8) * 0.1;
        lowHealthFilter = `brightness(${0.7 + flicker})`;
    }
    if (e.type === 'drifting' && e.health < e.maxHealth * 0.35) {
        lowHealthFilter = `brightness(${0.65 + Math.sin(TIME.elapsed * 6) * 0.15}) contrast(1.2)`;
    }
    if (lowHealthFilter && !stunFlash) {
        ctx.filter = lowHealthFilter;
    }
    
    // ══════════════════════════════════════════
    // DEEP PROCEDURAL ENEMY ANIMATION
    // Each type has unique movement personality:
    // bob cycle, weight shift, anticipation, attack poses, idle behavior
    // ══════════════════════════════════════════
    const T = TIME.elapsed;
    let eScaleX = 1, eScaleY = 1, eLean = 0;
    let eBobY = bobY; // override the simple bobY
    let eBobX = 0;
    let eAlpha = 1;
    
    if (e.type === 'lingering') {
        // ── LINGERING: Nervous, twitchy, constantly shifting weight ──
        // Like someone who can't stand still — feet shuffling, head darting
        const frustration = (e.frustration || 0);
        const tremFreq = 5 + frustration * 2;
        const tremAmp = 0.01 + frustration * 0.008;
        eLean = Math.sin(T * tremFreq + e.bobPhase) * tremAmp;
        // Rapid shallow breathing
        const breathe = Math.sin(T * 3 + e.bobPhase) * (1 + frustration * 0.3);
        eBobY = breathe;
        // Weight shift — lateral nervous shuffle
        eBobX = Math.sin(T * 2.5 + e.bobPhase * 2) * (1 + frustration * 0.5);
        eScaleY = 1 + Math.sin(T * 3) * 0.015;
        // When retreating: compressed, leaning away
        if (e.state === 'retreating') {
            eScaleX = 0.92;
            eScaleY = 1.05;
            eLean = -e.facing * 0.08;
            eBobY = Math.abs(Math.sin(T * 10)) * 3; // frantic hop
        }
        // Cornered: puffed up, shaking violently
        if (e.state === 'cornered_lashing') {
            eScaleX = 1.08 + Math.sin(T * 12) * 0.04;
            eScaleY = 0.95;
            eLean = Math.sin(T * 15) * 0.06;
        }
        
    } else if (e.type === 'watchful') {
        // ── WATCHFUL: Nearly motionless, ominous subtle pulse ──
        // Like a statue that you're not sure is alive — then it shifts
        const vig = (e.vigilanceStacks || 0);
        const vigPulse = vig * 0.008;
        // Extremely slow, heavy breathing
        eScaleX = 1 + Math.sin(T * 0.8) * vigPulse;
        eScaleY = 1 - Math.sin(T * 0.8) * vigPulse;
        // Barely perceptible head track toward player
        const dx = player.x - e.x;
        const trackLean = Math.max(-0.03, Math.min(0.03, dx * 0.002));
        eLean = trackLean;
        eBobY = Math.sin(T * 0.6 + e.bobPhase) * 0.5;
        // When attacking: sudden lunge forward
        if (e.attackCooldown < 0.3 && e.attackCooldown > 0) {
            const lunge = (0.3 - e.attackCooldown) / 0.3;
            eBobX = e.facing * lunge * 4;
            eScaleX = 1 + lunge * 0.12;
            eScaleY = 1 - lunge * 0.06;
            eLean = e.facing * lunge * 0.1;
        }
        
    } else if (e.type === 'huddled') {
        // ── HUDDLED: Shrinks when alone, emboldens in group, grief-rocking ──
        const panic = (e.isolationPanic || 0);
        const grief = (e.griefStacks || 0);
        // Scale reflects emotional state
        eScaleX = 1 - panic * 0.03;
        eScaleY = 1 - panic * 0.015;
        // Grief rocking — back and forth like keening
        if (grief > 0) {
            const rockSpeed = 4 + grief * 2;
            eLean = Math.sin(T * rockSpeed + e.bobPhase) * grief * 0.035;
            eBobY = Math.abs(Math.sin(T * rockSpeed)) * grief * 0.8;
        } else {
            // Idle huddle — small protective sway
            eLean = Math.sin(T * 1.2 + e.bobPhase) * 0.01;
            eBobY = Math.sin(T * 1.5 + e.bobPhase) * 0.6;
        }
        // Panic scatter when isolated
        if (panic > 3) {
            eBobX = Math.sin(T * 8 + e.bobPhase) * panic * 0.4;
            eBobY = Math.abs(Math.sin(T * 6)) * 2;
        }
        
    } else if (e.type === 'rehearsed') {
        // ── REHEARSED: Mechanical snap-poses, robotic precision ──
        // Moves like a puppet — sharp transitions, no easing
        const stateT = e.stateTimer || 0;
        if (e.state === 'pattern_lunge') {
            // Sharp forward lunge — no anticipation, just snap
            eScaleX = 1.15;
            eScaleY = 0.88;
            eLean = e.facing * 0.12;
            eBobX = e.facing * 3;
        } else if (e.state === 'pattern_recovery') {
            // Snap back to neutral — mechanical precision
            eScaleX = 0.93;
            eScaleY = 1.07;
            eLean = -e.facing * 0.03;
        } else if (e.state === 'pattern_circle') {
            // Robotic march — snappy step cycle
            const step = Math.floor(T * 4 + e.bobPhase) % 2;
            eLean = step === 0 ? 0.02 : -0.02;
            eBobY = step === 0 ? 1 : -0.5;
        } else if (e.isShattered) {
            // Pattern broken — jerky, confused, random twitches
            eLean = Math.sin(T * 10 + Math.random() * 0.5) * 0.15;
            eScaleX = 1 + Math.sin(T * 12) * 0.06;
            eScaleY = 1 - Math.sin(T * 14) * 0.04;
            eBobX = Math.sin(T * 7) * 2;
        } else {
            // Idle patrol — rigid with metronomic timing
            const tick = Math.sin(T * 2 + e.bobPhase);
            eLean = tick > 0.9 ? 0.015 : tick < -0.9 ? -0.015 : 0;
            eBobY = Math.abs(Math.sin(T * 2 + e.bobPhase)) * 0.8;
        }
        
    } else if (e.type === 'burdened') {
        // ── BURDENED: Massive, slow, ponderous weight ──
        // Moves like carrying an invisible boulder — every step is effort
        const unburdened = e.unburdened;
        if (!unburdened) {
            // Slow heavy sway, ponderous breathing
            eLean = Math.sin(T * 0.6 + e.bobPhase) * 0.04;
            eBobY = Math.sin(T * 0.8 + e.bobPhase) * 1.5;
            const heavyBreath = Math.sin(T * 0.7) * 0.025;
            eScaleY = 1 + heavyBreath;
            eScaleX = 1 - heavyBreath * 0.5;
            // Ground impact on each "step"
            const stepCycle = Math.sin(T * 1.2 + e.bobPhase);
            if (stepCycle > 0.95) {
                eScaleY = 0.96; eScaleX = 1.04; // impact squash
            }
        } else {
            // Unburdened — frantic, uncontrolled, weight suddenly gone
            eLean = Math.sin(T * 6) * 0.1;
            eScaleX = 1 + Math.sin(T * 8) * 0.05;
            eScaleY = 1 - Math.sin(T * 8) * 0.03;
            eBobY = Math.abs(Math.sin(T * 5)) * 4;
            eBobX = Math.sin(T * 3) * 3;
        }
        // Charge wind-up
        if (e.state === 'charging') {
            eScaleX = 1.1;
            eScaleY = 0.92;
            eLean = e.facing * 0.08;
            eBobX = e.facing * 2;
        }
        
    } else if (e.type === 'drifting') {
        // ── DRIFTING: Ethereal, floating, barely material ──
        // Moves like smoke — constant slow sway, translucent
        eLean = Math.sin(T * 1.0 + e.bobPhase) * 0.05;
        eBobY = Math.sin(T * 0.8 + e.bobPhase * 1.3) * 3;
        eBobX = Math.sin(T * 0.6 + e.bobPhase) * 2;
        eScaleX = 1 + Math.sin(T * 0.5) * 0.03;
        eScaleY = 1 + Math.sin(T * 0.7 + 1) * 0.02;
        eAlpha = 0.7 + Math.sin(T * 1.5 + e.bobPhase) * 0.15;
        if (e.state === 'lunging') {
            // Sudden solidification and strike
            eScaleX = 1.18;
            eScaleY = 0.88;
            eAlpha = 0.95;
            eLean = e.facing * 0.1;
            eBobX = e.facing * 4;
        } else if (e.state === 'phased') {
            eAlpha = 0.3 + Math.sin(T * 3) * 0.1;
            eScaleX = 0.9;
        }
        
    } else if (e.type === 'deferred') {
        // ── DEFERRED: Compressed, dormant, then violent unfurl ──
        if (e.state === 'idle' || e.state === 'dormant') {
            // Curled tight — barely visible pulse
            eScaleX = 0.75;
            eScaleY = 0.65;
            eBobY = Math.sin(T * 0.5 + e.bobPhase) * 0.3;
            // Subtle internal pressure pulse
            const pressurePulse = Math.sin(T * 2 + e.bobPhase) * 0.02;
            eScaleX += pressurePulse;
            eScaleY += pressurePulse;
        } else if (e.state === 'triggered') {
            // Violent unfurling — spring release
            const unfold = Math.min(1, (e.stateTimer || 0) / 0.4);
            const eased = 1 - Math.pow(1 - unfold, 3); // ease-out
            eScaleX = 0.75 + eased * 0.35;
            eScaleY = 0.65 + eased * 0.45;
            eLean = Math.sin(unfold * Math.PI * 3) * 0.08; // wobble during unfurl
            eBobY = -(eased * 5); // rise up
        } else {
            // Active — pulsing with released energy
            eScaleX = 1 + Math.sin(T * 4 + e.bobPhase) * 0.04;
            eScaleY = 1 - Math.sin(T * 4 + e.bobPhase) * 0.03;
            eLean = Math.sin(T * 2) * 0.03;
            eBobY = Math.sin(T * 3) * 1.5;
        }
        
    } else if (e.type === 'remembered') {
        // ── REMEMBERED: Eerily mirrors the player's animations ──
        // Uncanny valley — slightly off timing, like a reflection in dirty water
        const pState = player.state;
        const mirrorDelay = 0.3; // slight delay behind player
        const mT = T - mirrorDelay;
        if (pState === 'moving') {
            const mirrorCycle = Math.sin(mT * 7);
            eBobY = Math.abs(mirrorCycle) * 2;
            eScaleX = 1 + mirrorCycle * 0.025;
            eScaleY = 1 - mirrorCycle * 0.025;
            eLean = Math.sin(mT * 3.5) * 0.015;
        } else if (pState === 'attacking') {
            // Mimic attack pose
            eScaleX = 1.1;
            eScaleY = 0.93;
            eLean = e.facing * 0.1;
        } else {
            // Mirror idle breathing — slightly wrong rhythm
            const mirrorBreathe = Math.sin(mT * 2.3) * 0.018;
            eScaleX = 1 - mirrorBreathe;
            eScaleY = 1 + mirrorBreathe;
            eLean = Math.sin(mT * 0.7) * 0.008;
        }
        // Ghost double — echo shimmer
        if (e.mimicState === 'echo_dashing') {
            eAlpha = 0.6;
            eScaleX = 1.15;
            eScaleY = 0.88;
        }
    }
    
    ctx.globalAlpha = eAlpha;
    
    // ── 8-DIRECTIONAL ENEMY RENDERING ──
    // Direction-based scaling: narrower when facing toward/away, wider in profile
    const eDir = e.facingDir || 2;
    const eDirScaleX = [0.92, 0.96, 1.0, 0.96, 0.92, 0.96, 1.0, 0.96]; // N/S narrow, E/W full
    const eFlipX = (eDir >= 5 && eDir <= 7);
    const eDirWidth = eDirScaleX[eDir];
    
    if (img) {
        // Burdened has large green platform base — crop 30%; others get 5%
        const cropFrac = (e.type === 'burdened' || e.type === 'hollow_warden') ? 0.30 : 0.05;
        const cropBottom = Math.floor(img.height * cropFrac);
        const srcH = img.height - cropBottom;
        ctx.save();
        ctx.translate(sx + eBobX, sy + eBobY);
        if (eFlipX) ctx.scale(-1, 1);
        ctx.rotate(eLean);
        ctx.scale(Math.abs(eScaleX) * eDirWidth, eScaleY);
        ctx.drawImage(img, 0, 0, img.width, srcH, -spriteW / 2, -spriteH + 5, spriteW, spriteH);
        ctx.restore();
    } else {
        const colors = {
            lingering: '#2a2825', watchful: '#30281f', huddled: '#252320',
            rehearsed: '#28241e', burdened: '#1e1a16', drifting: 'rgba(35,30,28,0.6)',
            deferred: '#201c18', remembered: '#2c2822'
        };
        ctx.save();
        ctx.translate(sx + eBobX, sy + eBobY);
        if (eFlipX) ctx.scale(-1, 1);
        ctx.rotate(eLean);
        ctx.scale(Math.abs(eScaleX) * eDirWidth, eScaleY);
        ctx.fillStyle = colors[e.type] || '#252220';
        ctx.fillRect(-8, -spriteH + 8, 16, spriteH - 10);
        ctx.fillRect(-5, -spriteH, 10, 10);
        ctx.restore();
    }
    
    ctx.globalAlpha = 1;
    
    if (stunFlash || lowHealthFilter) {
        ctx.filter = 'none';
    }
    
    // Health bar when damaged
    if (e.health < e.maxHealth) {
        const barW = (e.type === 'watchful') ? 30 : (e.type === 'drifting' ? 20 : 24);
        const barH = 2;
        const barY = sy - spriteH - 4 + bobY;
        const healthPct = e.health / e.maxHealth;
        
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(sx - barW / 2, barY, barW, barH);
        
        // Color shifts at low health
        let barColor;
        if (healthPct > 0.5) {
            barColor = 'rgba(140,50,40,0.7)';
        } else if (healthPct > 0.25) {
            barColor = 'rgba(160,70,30,0.8)';
        } else {
            // Pulsing red at critical
            const pulse = Math.sin(TIME.elapsed * 6) * 0.15;
            barColor = `rgba(180,40,30,${0.8 + pulse})`;
        }
        ctx.fillStyle = barColor;
        ctx.fillRect(sx - barW / 2, barY, barW * healthPct, barH);
        
        // Watchful: show vigilance stacks as pips above health bar
        if (e.type === 'watchful' && e.vigilanceStacks > 0.5) {
            const stackCount = Math.floor(e.vigilanceStacks);
            const pipY = barY - 4;
            for (let i = 0; i < stackCount; i++) {
                const pipAlpha = 0.3 + (e.vigilanceStacks - i) * 0.15;
                ctx.fillStyle = `rgba(180,140,60,${Math.min(0.8, pipAlpha)})`;
                ctx.fillRect(sx - stackCount * 2.5 + i * 5, pipY, 3, 2);
            }
        }
        
        // Drifting: health bar is semi-transparent — hard to read, like the creature
        if (e.type === 'drifting') {
            ctx.globalAlpha = 0.6;
            ctx.globalAlpha = 1;
        }
    }
    
    // Drifting — state-based visual feedback
    if (e.type === 'drifting' && !e.dead) {
        if (e.state === 'orbiting') {
            // Ghostly orbit trail — faint afterimages
            ctx.globalAlpha = 0.1;
            ctx.fillStyle = '#3a3530';
            for (let i = 0; i < 4; i++) {
                const trailAngle = e.orbitAngle - e.orbitDir * (i + 1) * 0.4;
                const trailR = 6;
                ctx.fillRect(
                    sx - Math.cos(trailAngle) * trailR - 4,
                    sy - Math.sin(trailAngle) * trailR - 30 + bobY,
                    8, 20
                );
            }
            ctx.globalAlpha = 1;
        }
        
        if (e.state === 'lunging') {
            // Lunge streak — sharp motion line
            ctx.strokeStyle = 'rgba(80,70,60,0.4)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(sx, sy - 20 + bobY);
            if (e.dashTarget) {
                const ltPos = worldToScreen(e.dashTarget.x, e.dashTarget.y);
                const ltSx = ltPos.x + cam.x;
                const ltSy = ltPos.y + cam.y;
                const lungeAngle = Math.atan2(ltSy - (sy - 20), ltSx - sx);
                ctx.lineTo(sx - Math.cos(lungeAngle) * 20, sy - 20 + bobY - Math.sin(lungeAngle) * 20);
            }
            ctx.stroke();
            
            // Body blur
            ctx.globalAlpha = 0.2;
            ctx.fillStyle = '#2a2520';
            ctx.fillRect(sx - 10, sy - spriteH + bobY, 20, spriteH - 5);
            ctx.globalAlpha = 1;
        }
        
        if (e.state === 'disengaging') {
            // Scattering wisps while retreating
            ctx.globalAlpha = 0.15;
            ctx.fillStyle = '#4a4035';
            for (let i = 0; i < 2; i++) {
                ctx.beginPath();
                ctx.arc(sx + (Math.random() - 0.5) * 15, sy - 20 + (Math.random() - 0.5) * 15 + bobY, 3, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }
    }
    
    // Watchful — state-based visual feedback
    if (e.type === 'watchful' && !e.dead) {
        // Vigilance indicator — eye intensity scales with stacks
        const vigAlpha = 0.2 + Math.min(0.6, e.vigilanceStacks * 0.12);
        const vigSize = 2 + e.vigilanceStacks * 0.4;
        const vigPulse = Math.sin(TIME.elapsed * (3 + e.vigilanceStacks)) * 0.1;
        
        if (e.state === 'watching') {
            // Slow scanning eye — rotates
            const eyeX = sx + Math.cos(e.scanAngle) * 3;
            const eyeY = sy - 42 + bobY + Math.sin(e.scanAngle * 0.7) * 1;
            ctx.fillStyle = `rgba(120,80,50,${vigAlpha + vigPulse})`;
            ctx.beginPath();
            ctx.arc(eyeX, eyeY, vigSize, 0, Math.PI * 2);
            ctx.fill();
            
            // Vigilance stacks shown as dim marks below
            if (e.vigilanceStacks > 0.5) {
                ctx.fillStyle = `rgba(100,70,40,${0.15 * Math.min(1, e.vigilanceStacks)})`;
                const stackCount = Math.floor(e.vigilanceStacks);
                for (let i = 0; i < stackCount; i++) {
                    ctx.fillRect(sx - stackCount * 3 + i * 6, sy + 6, 4, 2);
                }
            }
        }
        
        if (e.state === 'warning') {
            // Telegraph — pulsing bright ring, expanding warning
            const warnPulse = Math.sin(TIME.elapsed * 12) * 0.5 + 0.5;
            const warnR = 8 + warnPulse * 6;
            
            ctx.strokeStyle = `rgba(180,130,60,${0.3 + warnPulse * 0.4})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(sx, sy - 35 + bobY, warnR, 0, Math.PI * 2);
            ctx.stroke();
            
            // Eye blazes
            ctx.fillStyle = `rgba(200,150,60,${0.5 + warnPulse * 0.4})`;
            ctx.shadowColor = '#c0a040';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(sx, sy - 42 + bobY, vigSize + 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            
            // Aim line toward player
            const aimAngle = Math.atan2(player.y - e.y, player.x - e.x);
            const aimPos = worldToScreen(
                e.x + Math.cos(aimAngle) * 2,
                e.y + Math.sin(aimAngle) * 2
            );
            ctx.strokeStyle = `rgba(180,130,60,${0.15 + warnPulse * 0.1})`;
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(sx, sy - 35 + bobY);
            ctx.lineTo(aimPos.x + cam.x, aimPos.y + cam.y);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        if (e.state === 'burst_firing') {
            // Muzzle flash + intense eye
            ctx.fillStyle = `rgba(200,150,60,${0.6 + Math.random() * 0.3})`;
            ctx.shadowColor = '#c09030';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(sx, sy - 42 + bobY, vigSize + 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            
            // Flash recoil glow
            ctx.globalAlpha = 0.15 + Math.random() * 0.1;
            ctx.fillStyle = '#a08040';
            ctx.beginPath();
            ctx.arc(sx, sy - 30 + bobY, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        if (e.state === 'overcommitted') {
            // Locked up — dim, flickering, vulnerable indicator
            const flicker = Math.sin(TIME.elapsed * 6) * 0.5 + 0.5;
            ctx.fillStyle = `rgba(60,45,30,${0.15 + flicker * 0.1})`;
            ctx.beginPath();
            ctx.arc(sx, sy - 42 + bobY, 2, 0, Math.PI * 2);
            ctx.fill();
            
            // Crackle lines — overstressed
            ctx.strokeStyle = `rgba(80,60,35,${0.1 + flicker * 0.05})`;
            ctx.lineWidth = 0.5;
            for (let i = 0; i < 2; i++) {
                ctx.beginPath();
                ctx.moveTo(sx + (Math.random()-0.5)*16, sy - 45 + bobY);
                ctx.lineTo(sx + (Math.random()-0.5)*20, sy - 25 + bobY);
                ctx.stroke();
            }
        }
    }
    
    // Remembered shimmer
    if (e.type === 'remembered' && !e.dead) {
        ctx.strokeStyle = `rgba(100,90,80,${0.1 + Math.sin(TIME.elapsed * 2) * 0.05})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(sx, sy - 25 + bobY, 20, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    ctx.globalAlpha = 1.0;
}

function renderHaze(cam) {
    // reduce cost under heavy restraint: early overlay and return
    try {
        if (greyline.getSide() === 'restraint' && greyline.getExtremity() > 0.7) {
            ctx.save();
            ctx.globalAlpha = 0.4;
            ctx.fillStyle = 'rgba(40,30,20,1)';
            ctx.fillRect(0,0,canvas.width,canvas.height);
            ctx.restore();
            return;
        }
    } catch(e) {}
    // Track strongest local shadow influence across all pools (used for the global overlay)
    let maxShadowFactor = 0.0;

    for (const pool of world.hazePools) {
        const pos = worldToScreen(pool.x, pool.y);
        const sx = pos.x + cam.x;
        const sy = pos.y + cam.y;

        const _cvw = canvas.width / camera.zoom, _cvh = canvas.height / camera.zoom;
        if (sx < -200 || sx > _cvw + 200 || sy < -200 || sy > _cvh + 200) continue;

        const pulse = Math.sin(TIME.percept * 0.55 + pool.pulse) * 0.12;
        const r = pool.radius * TILE_W * 0.5;

        // --- local shadow influence (per-pool) ---
        let localShadow = 0.0;
        // props (small occluders)
        if (world && world.props) {
            for (const p of world.props) {
                const dx = p.x - pool.x, dy = p.y - pool.y;
                const d = Math.sqrt(dx*dx + dy*dy);
                const maxD = Math.max(1.0, pool.radius + 3.0);
                if (d <= maxD) {
                    const influence = 0.20 * (1 - (d / maxD));
                    localShadow = Math.max(localShadow, influence);
                }
            }
        }
        // trees (stronger occlusion)
        if (world && world.trees) {
            for (const t of world.trees) {
                const dx = t.x - pool.x, dy = t.y - pool.y;
                const d = Math.sqrt(dx*dx + dy*dy);
                const maxD = Math.max(1.0, pool.radius + 4.0);
                if (d <= maxD) {
                    const influence = 0.40 * (1 - (d / maxD));
                    localShadow = Math.max(localShadow, influence);
                }
            }
        }
        // structures (broader occluders)
        if (world && world.structures) {
            for (const s of world.structures) {
                const dx = s.x - pool.x, dy = s.y - pool.y;
                const d = Math.sqrt(dx*dx + dy*dy);
                const maxD = Math.max(1.0, pool.radius + Math.max(s.w||1, s.h||1) + 2.0);
                if (d <= maxD) {
                    const influence = 0.25 * (1 - (d / maxD));
                    localShadow = Math.max(localShadow, influence);
                }
            }
        }
        localShadow = clamp01(localShadow * 1.2);
        maxShadowFactor = Math.max(maxShadowFactor, localShadow);

        // --- pool color/alpha (now respects local shadow influence) ---
        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
        const samT = (greyline.samTier||0)/3;
        const col = {r:15 + samT*40, g:13 + samT*10, b:11 + samT*55};

        const baseAlpha = (pool.density + pulse) * (0.85 + samT*0.25);
        const innerAlpha = clamp01(baseAlpha * (1.0 + localShadow * (greyline.knobs?.env?.hazeShadowAlign ?? 0.65)));
        const midAlpha   = clamp01(baseAlpha * (0.42 + samT*0.18) * (1.0 + localShadow * (greyline.knobs?.env?.hazeShadowAlign ?? 0.65)));

        grad.addColorStop(0, `rgba(${col.r|0},${col.g|0},${col.b|0},${innerAlpha})`);
        grad.addColorStop(0.6, `rgba(${col.r|0},${col.g|0},${col.b|0},${midAlpha})`);
        grad.addColorStop(1, 'rgba(15,13,11,0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(sx, sy, r, r * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // DEV: per-pool debug (shadows/density)
        if (typeof DEV_VFX_DEBUG !== 'undefined' && DEV_VFX_DEBUG) {
            ctx.save();
            ctx.fillStyle = `rgba(255,255,255,${Math.min(0.9, innerAlpha * 1.8)})`;
            ctx.font = '10px monospace';
            ctx.fillText(`sh:${localShadow.toFixed(2)} d:${pool.density.toFixed(2)}`, sx - 18, sy - Math.max(8, r * 0.2));
            ctx.restore();
        }
    }
    
    const edgeDist = greyline.getDistance();
    const kVfx = greyline.knobs?.vfx || {};
    const hazEdge = Math.max(0, Math.min(1, kVfx.hazeEdge ?? (0.1 + edgeDist*0.4)));
    const samT = (greyline.samTier||0)/3;
    // Base haze opacity (driven by greyline state)
    // Increase base haze so pools and global overlay are more perceptible by default
    const hazeBase = (0.28 + edgeDist * 0.36 + hazEdge * 0.32 + samT * 0.18) * (greyline.knobs?.env?.hazDensity ?? 1.0);

    // Use the strongest pool-local shadow influence to nudge the global top/bottom haze overlay
    const hazeShadowAlign = greyline.knobs?.env?.hazeShadowAlign ?? 0.65;
    const shadowFactor = clamp01(maxShadowFactor);

    // Final haze overlay opacity (global) scaled by strongest local occlusion nearby
    // Strengthen global haze a bit for visibility, but clamp to safe range
    const hazeOpacity = clamp01(hazeBase * (1.0 + shadowFactor * hazeShadowAlign) * 1.5);

    // DEV: show global shadow factor / alignment (for tuning)
    if (typeof DEV_VFX_DEBUG !== 'undefined' && DEV_VFX_DEBUG) {
        ctx.save();
        ctx.fillStyle = `rgba(255,255,255,${Math.min(0.9, hazeOpacity * 1.8)})`;
        ctx.font = '10px monospace';
        ctx.fillText(`shadowMax:${shadowFactor.toFixed(2)} hA:${hazeShadowAlign.toFixed(2)} base:${hazeBase.toFixed(2)}`, 12, 28);
        ctx.restore();
    }    
    // Use zoom-adjusted dimensions since we're inside the zoom transform
    const zW = canvas.width / camera.zoom;
    const zH = canvas.height / camera.zoom;
    
    const topGrad = ctx.createLinearGradient(0, 0, 0, zH * 0.25);
    topGrad.addColorStop(0, `rgba(10,9,8,${hazeOpacity})`);
    topGrad.addColorStop(1, 'rgba(10,9,8,0)');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, zW, zH * 0.25);
    
    const botGrad = ctx.createLinearGradient(0, zH * 0.75, 0, zH);
    botGrad.addColorStop(0, 'rgba(10,9,8,0)');
    botGrad.addColorStop(1, `rgba(10,9,8,${hazeOpacity})`);
    ctx.fillStyle = botGrad;
    ctx.fillRect(0, zH * 0.75, zW, zH * 0.25);
}

function renderVignette() {
    const W = canvas.width;
    const H = canvas.height;
    const dist = greyline.getDistance();
    const side = greyline.getSide();
    const k = greyline.knobs?.vfx || {};
    // cap vignette to a gentle amount regardless of input
    // more aggressive base so full restraint actually hits the cap
    let rawVig = k.vignette ?? (0.15 + dist * 0.5);
    // also boost when saturation is low to keep border visible
    const sat = k.saturation ?? 1.0;
    rawVig += (1 - sat) * 0.3;
    const vig = Math.max(0, Math.min(0.60, rawVig));
    const hazeEdge = Math.max(0, Math.min(1, k.hazeEdge ?? (0.1 + dist * 0.4)));

    ensurePostBuffers();
    let grain = Math.max(0, Math.min(1, k.grain ?? 0.0));
    let flick = Math.max(0, Math.min(1, k.flicker ?? 0.0));
    let ghost = Math.max(0, Math.min(1, k.ghost ?? 0.0));
    // degrade intensities when performance drops
    if (typeof perfQuality !== 'undefined') {
        grain *= perfQuality;
        flick *= perfQuality;
        ghost *= perfQuality;
    }

    // Ghosting / motion trails (compulsion + trend): smear the *world* slightly, not a hard effect
    if (ghost > 0.02) {
        const ox = (Math.sin(TIME.percept * 2.2) * 1.2 + (Math.random() - 0.5) * 0.8) * ghost * (side === 'compulsion' ? 1.6 : 0.8);
        const oy = (Math.cos(TIME.percept * 1.9) * 1.0 + (Math.random() - 0.5) * 0.8) * ghost * (side === 'compulsion' ? 1.4 : 0.7);
        ctx.globalAlpha = 0.18 * ghost;
        ctx.drawImage(lastFrameCanvas, ox, oy);
        ctx.globalAlpha = 1.0;
    }

    // Subtle flicker (overstimulation) — never a jumpscare
    if (flick > 0.05 && Math.random() < flick * 0.06) {
        ctx.fillStyle = `rgba(0,0,0,${0.05 + flick * 0.10})`;
        ctx.fillRect(0,0,W,H);
    }
    
    const cx = W / 2, cy = H / 2;
    const innerR = W * 0.65;   // make ring slightly wider so the dark border is easier to spot
    const outerR = W * 0.98;
    const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.75, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${vig})`);
    // we no longer add any nonlinear or extreme-tunnel boosts for restraint
    let extraVigBoost = 0;
    /*
    // previous implementation:
    // Non-linear boost so deep restraint becomes visually obvious on all displays
    let extraVigBoost = (vig > 0.8) ? (Math.pow((vig - 0.8) / 0.2, 1.5) * 0.25) : 0;
    // Extra strong tunnel for extreme restraint (explicit UX request)
    try {
        const extremity = (typeof greyline.getExtremity === 'function') ? greyline.getExtremity() : 0;
        if (side === 'restraint' && extremity > 0.65) {
            // non-linear ramp so the tunnel closes sharply as restraint deepens
            extraVigBoost += Math.pow((extremity - 0.65) / 0.35, 1.8) * 0.45;
        }
    } catch (e) {}
    */
    const finalVigAlpha = Math.min(1.0, 0.15 + vig * 0.65 + extraVigBoost);
    grad.addColorStop(1, `rgba(10,9,8,${finalVigAlpha})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Peripheral haze disabled per user request
    // if (hazeEdge > 0.02) {
    //     const hg = ctx.createRadialGradient(W/2, H/2, W*0.45, W/2, H/2, W*0.90);
    //     hg.addColorStop(0, 'rgba(0,0,0,0)');
    //     hg.addColorStop(1, `rgba(15,14,18,${0.06 + hazeEdge * 0.18})`);
    //     ctx.fillStyle = hg;
    //     ctx.fillRect(0,0,W,H);
    // }

    // Film grain / radio static texture (audible in the eye)
    if (grain > 0.02) {
        ctx.save();
        // stronger grain overlay alpha for visibility across devices
        ctx.globalAlpha = Math.min(0.30, 0.06 + grain * 0.14);
        // overlay is preferred but may be unsupported in some environments — fallback to source-over
        try { ctx.globalCompositeOperation = 'overlay'; } catch(e) { ctx.globalCompositeOperation = 'source-over'; }
        const ox = (Math.random() * 256) | 0;
        const oy = (Math.random() * 256) | 0;
        for (let x = -256; x < W + 256; x += 256) {
            for (let y = -256; y < H + 256; y += 256) {
                ctx.drawImage(grainCanvas, x - ox, y - oy);
            }
        }
        ctx.restore();
    }

    // restraint tunnel‑vision/darkening removed; only simple vignette above now affects the image
    // if (side === 'restraint' && dist > 0.3) {
    //     // Tunnel vision: narrowing + slight desaturation tint (amplified at high vig)
    //     const baseAlpha = Math.min(0.18, (dist - 0.3) * 0.12);
    //     const tunnelBoost = Math.min(0.45, Math.pow(vig, 2) * 0.35);
    //     ctx.fillStyle = `rgba(18,18,20,${Math.min(0.32, baseAlpha + tunnelBoost)})`;
    //     ctx.fillRect(0,0,W,H);
    //     const intensity = (dist - 0.3) / 0.7;
    //     const adjIntensity = Math.min(1.0, intensity * (1.0 + vig * 0.35));
    //     const rGrad = ctx.createRadialGradient(W / 2, H / 2, W * (0.25 - adjIntensity * 0.1), W / 2, H / 2, W * 0.5);
    //     rGrad.addColorStop(0, 'rgba(10,9,8,0)');
    //     rGrad.addColorStop(1, `rgba(10,9,8,${adjIntensity * 0.6})`);
    //     ctx.fillStyle = rGrad;
    //     ctx.fillRect(0, 0, W, H);
    // }
    
    if (side === 'compulsion' && dist > 0.3) {
        // Overstimulation: violet desync wash

        const intensity = (dist - 0.3) / 0.7;
        ctx.fillStyle = `rgba(110,80,160,${intensity * 0.07})`;
        ctx.fillRect(0, 0, W, H);
        
        if (intensity > 0.3) {
            ctx.globalAlpha = intensity * 0.04;
            for (let i = 0; i < 30; i++) {
                ctx.fillStyle = Math.random() > 0.5 ? '#3a2a1a' : '#1a1210';
                ctx.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 4, 1 + Math.random() * 2);
            }
            ctx.globalAlpha = 1.0;
        }
    }


    // Grain + scanlines (radio static): compulsion floods, restraint quiets
    if (grain > 0.01) {
        // slightly stronger scanline/noise visibility
        ctx.globalAlpha = 0.14 * grain;
        const n = 120 + Math.floor(grain * 220);
        for (let i = 0; i < n; i++) {
            const w = 8 + Math.random() * 40;
            const h = 1 + Math.random() * 3;
            ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.18)';
            ctx.fillRect(Math.random()*W, Math.random()*H, w, h);
        }
        ctx.globalAlpha = 1.0;
    }

    // Thin scanlines under pressure
    const warn = Math.max(0, Math.min(1, (greyline.knobs?.ui?.warn ?? 0)));
    const lineA = Math.min(0.25, warn * 0.14 + grain * 0.10);
    if (lineA > 0.01) {
        ctx.globalAlpha = lineA;
        // make scanlines darker so they read at modest grain/warn values
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        for (let y = 0; y < H; y += 3) {
            ctx.fillRect(0, y, W, 1);
        }
        ctx.globalAlpha = 1.0;
    }

}

function renderGreylinePostFX() {
    if (!gameStarted || !ctx) return;
    const k = greyline.knobs?.vfx || {};
    const grain = Math.min(1, Math.max(0, k.grain ?? 0));
    const flicker = Math.min(1, Math.max(0, k.flicker ?? 0));
    if (grain <= 0.01 && flicker <= 0.01) return;

    // Subtle radio-static grain overlay (screen-space, no perspective)
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);

    // Flicker: intermittent opacity modulation
    const t = performance.now() * 0.001;
    const flick = 0.65 + 0.35 * Math.sin(t * (6 + flicker * 20));
    // Increase grain intensity and density for a thicker, more visible static
    const alpha = (0.06 + grain * 0.35) * (flicker > 0 ? flick : 1);

    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#000";
    // Denser noise dots scaled with grain
    const dots = Math.floor((canvas.width * canvas.height) / 2000 * (1.0 + grain));
    for (let i = 0; i < dots; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        // increase larger-dot frequency so grain reads thicker
        const s = (Math.random() < 0.7) ? 1 : (Math.random() < 0.65 ? 2 : 3);
        ctx.fillRect(x, y, s, s);
    }

    // Occasional horizontal scanline tear at high samsarra
    if ((greyline.samTier||0) >= 2 && Math.random() < 0.25 * grain) {
        // stronger tear alpha so horizontal tears read more visibly
        ctx.globalAlpha = 0.14 + grain * 0.22;
        const y = Math.random() * canvas.height;
        ctx.fillRect(0, y, canvas.width, 2);
    }

    ctx.restore();
}

// ============================================================
// UI UPDATES
// ============================================================
function updateUI() {
    // ── HEALTH BARS — condition indicators, not meters ──
    const healthBar = document.getElementById('health-bar');
    const healthLabel = document.getElementById('health-label');
    if (healthBar) {
        const pct = player.health / player.maxHealth;
        healthBar.style.width = `${pct * 100}%`;
        // Color shifts subtly — no dramatic red flashing
        if (pct < 0.3) {
            healthBar.style.background = 'rgba(130,50,40,0.65)';
            if (healthLabel) healthLabel.className = 'stat-label critical';
        } else if (pct < 0.6) {
            healthBar.style.background = 'rgba(120,65,55,0.6)';
            if (healthLabel) healthLabel.className = 'stat-label strained';
        } else {
            healthBar.style.background = 'rgba(120,75,65,0.6)';
            if (healthLabel) healthLabel.className = 'stat-label';
        }
    }
    
    const staminaBar = document.getElementById('stamina-bar');
    if (staminaBar) staminaBar.style.width = `${(player.stamina / player.maxStamina) * 100}%`;
    
    const burdenBar = document.getElementById('burden-bar');
    const burdenLabel = document.getElementById('burden-label');
    if (burdenBar) {
        const bPct = player.burden / player.maxBurden;
        burdenBar.style.width = `${bPct * 100}%`;
        if (bPct > 0.8) {
            burdenBar.style.background = 'rgba(100,50,110,0.65)';
            if (burdenLabel) burdenLabel.className = 'stat-label critical';
        } else if (bPct > 0.5) {
            if (burdenLabel) burdenLabel.className = 'stat-label strained';
        } else {
            if (burdenLabel) burdenLabel.className = 'stat-label';
        }
    }
    
    // ── GREYLINE — living fracture indicator ──
    const glBar = document.getElementById('greyline-bar');
    const glContainer = document.getElementById('greyline-container');
    if (glBar) glBar.style.left = `${greyline.value * 100}%`;
    
    // Greyline visibility — fades in when relevant
    if (glContainer) {
        if (greyline.visibleTimer > 0.5) {
            glContainer.classList.add('visible');
        } else {
            glContainer.classList.remove('visible');
        }
    }
    
    // Render the greyline fracture canvas
    const fracCanvas = document.getElementById('greyline-fracture');
    if (fracCanvas) {
        const fCtx = fracCanvas.getContext('2d');
        const fw = fracCanvas.width;
        const fh = fracCanvas.height;
        fCtx.clearRect(0, 0, fw, fh);
        
        const dist = greyline.getDistance();
        const side = greyline.getSide();
        
        // Draw the fracture line — thickens at extremes
        const lineY = fh / 2;
        const thickness = 0.5 + dist * 2;
        
        fCtx.strokeStyle = `rgba(100,85,70,${0.15 + dist * 0.2})`;
        fCtx.lineWidth = thickness;
        fCtx.beginPath();
        fCtx.moveTo(0, lineY);
        
        // Jitter increases at extremes
        const segments = 30;
        for (let i = 1; i <= segments; i++) {
            const x = (i / segments) * fw;
            const jitter = dist > 0.2 ? (Math.sin(TIME.elapsed * 4 + i * 0.8) + Math.random() - 0.5) * dist * 3 : 0;
            fCtx.lineTo(x, lineY + jitter);
        }
        fCtx.stroke();
        
        // Side lean — one side darkens
        if (side === 'restraint' && dist > 0.15) {
            const grad = fCtx.createLinearGradient(0, 0, fw * 0.5, 0);
            grad.addColorStop(0, `rgba(60,70,80,${dist * 0.15})`);
            grad.addColorStop(1, 'rgba(60,70,80,0)');
            fCtx.fillStyle = grad;
            fCtx.fillRect(0, 0, fw * 0.5, fh);
        }
        if (side === 'compulsion' && dist > 0.15) {
            const grad = fCtx.createLinearGradient(fw * 0.5, 0, fw, 0);
            grad.addColorStop(0, 'rgba(80,50,40,0)');
            grad.addColorStop(1, `rgba(80,50,40,${dist * 0.15})`);
            fCtx.fillStyle = grad;
            fCtx.fillRect(fw * 0.5, 0, fw * 0.5, fh);
        }
    }
    
    // ── PSYCH STATS — all 6, peripheral, felt not read ──
    const statMap = {
        'stat-agency': psychStats.agency,
        'stat-awareness': psychStats.awareness,
        'stat-precision': psychStats.precision,
        'stat-adaptability': psychStats.adaptability,
        'stat-integrity': psychStats.integrity,
        'stat-burden': psychStats.burden,
    };
    
    for (const [id, stat] of Object.entries(statMap)) {
        const el = document.getElementById(id);
        if (!el) continue;
        const key = id.replace('stat-', '');
        const status = psychStats.getStatus(key);
        // No status text — just the stat name. Feel, don't read.
        el.textContent = stat.label;
        el.className = 'psych-stat';
        if (status === 'degraded') el.classList.add('degraded');
        else if (status === 'strained') el.classList.add('strained');
        else el.classList.add('active');
    }
    
    // ── SKILLS — breathing glyphs, not cooldown wheels ──
    const skills = [
        { id: 'skill-1', cd: player.cooldowns.predatory, usage: player.skillUsage.predatory },
        { id: 'skill-2', cd: player.cooldowns.snare, usage: player.skillUsage.snare },
        { id: 'skill-3', cd: player.cooldowns.reclaim, usage: player.skillUsage.reclaim },
        { id: 'skill-4', cd: player.cooldowns.attune, usage: player.skillUsage.attune },
        { id: 'skill-5', cd: player.cooldowns.burdenShift, usage: player.skillUsage.burdenShift },
        { id: 'skill-6', cd: player.cooldowns.shadow, usage: player.skillUsage.shadow },
    ];
    
    for (const s of skills) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        
        // Remove all state classes
        el.classList.remove('on-cooldown', 'ready', 'strained', 'warped');
        
        if (s.cd > 0) {
            el.classList.add('on-cooldown');
        } else if (s.usage > 3) {
            // Overused — glyph warps
            el.classList.add('warped');
        } else if (s.usage > 1.5) {
            // Strained from recent use
            el.classList.add('strained');
        } else {
            el.classList.add('ready');
        }
        
        // Subtle breathing animation on icons
        const icon = el.querySelector('.icon');
    }

    // Update potion HUD (bottom bar)
    const potionIcon = document.getElementById('potion-icon');
    const potionCount = document.getElementById('potion-count');
    if (potionCount) potionCount.textContent = `${player.potions}/${player.maxPotions}`;
    if (potionIcon && loadedImages.uiHealthOrb) potionIcon.src = ASSETS.uiHealthOrb;
    
    // ── GREYLINE EFFECT ON UI LAYOUT ──
    const side = greyline.getSide();
    const extr = greyline.getExtremity();
    const skillsBar = document.getElementById('skills-bar');
    if (skillsBar) {
        // Compulsion: skills crowd inward
        // Restraint: skills drift outward
        const gapShift = side === 'compulsion' ? Math.max(4, 10 - extr * 8) :
                         side === 'restraint' ? 10 + extr * 6 : 10;
        skillsBar.style.gap = `${gapShift}px`;
    }
}

// ============================================================
// INPUT HANDLING
// ============================================================
function handleInput() {
    // ── NPC PROXIMITY CHECK ──
    nearestNPC = null;
    if (isPlayerInHub()) {
        let closestDist = Infinity;
        for (const npc of world.npcs) {
            const nd = Math.sqrt((player.x - npc.x) ** 2 + (player.y - npc.y) ** 2);
            if (nd < 2.5 && nd < closestDist) {
                closestDist = nd;
                nearestNPC = npc;
            }
        }
    }
    
    // Show/hide interact prompt
    const interactPrompt = document.getElementById('interact-prompt');
    if (interactPrompt) {
        if (nearestNPC && !activeDialogue && !shopOpen) {
            interactPrompt.textContent = nearestNPC.id === 'mender' ? `E — trade with ${nearestNPC.name}` : `E — speak to ${nearestNPC.name}`;
            interactPrompt.classList.add('visible');
        } else {
            interactPrompt.classList.remove('visible');
        }
    }
    
    // ── DIALOGUE DISMISS — E or click when dialogue active ──
    if (activeDialogue) {
        if (input.keys['e'] || input.mouse.clicked) {
            dismissDialogue();
            input.keys['e'] = false;
            input.mouse.clicked = false;
        }
        return; // Block all other input during dialogue
    }
    
    // Basic attack — left click
    if (input.mouse.clicked) {
        player.attack();
    }
    // Gun — right click
    if (input.mouse.rightClicked) {
        player.shootGun();
        input.mouse.rightClicked = false;
    }
    // Reload — R (optional)
    if (input.keys['r']) {
        player.startReload();
    }
    
    // ── E KEY — context sensitive ──
    // Near NPC in hub: talk (or trade with Sable). Otherwise: Adaptive Snare.
    if (input.keys['e']) {
        if (nearestNPC) {
            if (nearestNPC.id === 'mender') {
                openShop();
            } else {
                openDialogue(nearestNPC);
            }
        } else {
            player.adaptiveSnare();
        }
        input.keys['e'] = false;
    }
    
    // Skill 1: Predatory Motion — Space or 1
    if (input.keys['1'] || input.keys[' ']) {
        player.requestSkill('predatory', () => player.predatoryMotion(), 0.04, 0.08);
        input.keys['1'] = false;
        input.keys[' '] = false;
    }
    // Skill 2: Adaptive Snare — 2
    if (input.keys['2']) {
        player.requestSkill('snare', () => player.adaptiveSnare(), 0.06, 0.12);
        input.keys['2'] = false;
    }
    // Skill 3: Reclamation — 3
    if (input.keys['3']) {
        player.requestSkill('reclaim', () => player.reclamation(), 0.08, 0.15);
        input.keys['3'] = false;
    }
    // Skill 4: Attunement — 4
    if (input.keys['4']) {
        player.requestSkill('attune', () => player.attune(), 0.07, 0.12);
        input.keys['4'] = false;
    }
    // Skill 5: Burden Shift — 5
    if (input.keys['5']) {
        player.requestSkill('burden', () => player.burdenShift(), 0.06, 0.12);
        input.keys['5'] = false;
    }
    // Skill 6: Shadow Acknowledgement — 6
    if (input.keys['6']) {
        player.requestSkill('shadow', () => player.shadowAcknowledge(), 0.09, 0.18);
        input.keys['6'] = false;
    }

    // Also support alternative binds — map potion consume to C (preferred)
    if (input.keys['c'] || input.keys['q']) {
        // Prefer C, but accept Q as a fallback for users with old muscle memory
        if (input.keys['c'] || input.keys['q']) {
            if (player.potions > 0) {
                player.consumePotion();
            } else {
                // when no potions, Q/C fallback triggers predatory motion
                player.requestSkill('predatory', () => player.predatoryMotion(), 0.04, 0.08);
            }
        }
        input.keys['c'] = false;
        input.keys['q'] = false;
    }
    if (input.keys['r']) {
        player.requestSkill('reclaim', () => player.reclamation(), 0.08, 0.15);
        input.keys['r'] = false;
    }
    if (input.keys['f']) {
        player.requestSkill('attune', () => player.attune(), 0.07, 0.12);
        input.keys['f'] = false;
    }
}

// ── NPC DIALOGUE SYSTEM ──
function openDialogue(npc) {
    const box = document.getElementById('dialogue-box');
    const speaker = document.getElementById('dialogue-speaker');
    const text = document.getElementById('dialogue-text');
    if (!box || !speaker || !text) return;
    
    activeDialogue = npc;
    speaker.textContent = npc.name;
    speaker.style.color = npc.accent;
    text.textContent = npc.dialogues[npc.dialogueIndex % npc.dialogues.length];
    npc.dialogueIndex++;
    
    box.classList.add('visible');
}

function dismissDialogue() {
    const box = document.getElementById('dialogue-box');
    if (box) box.classList.remove('visible');
    activeDialogue = null;
}

// ============================================================
// GAME LOOP
// ============================================================
let lastTime = 0;
let gameStarted = false;
let inventoryOpen = false;
let upgradeOpen = false;

function isPlayerInHub() {
    const hubX = WORLD_SIZE / 2;
    const hubY = WORLD_SIZE / 2;
    const dist = Math.sqrt((player.x - hubX)**2 + (player.y - hubY)**2);
    return dist < HUB_SAFE_RADIUS;
}

function gameLoop(timestamp) {
    requestAnimationFrame(gameLoop);
    
    if (!gameStarted) return;
    if (gameState === GameState.TITLE || gameState === GameState.CONTROLS) return;
    if (inventoryOpen || upgradeOpen || shopOpen) {
        input.clearFrame();
        return;
    }
    // Dialogue pauses gameplay but still renders
    const dialogueActive = !!activeDialogue;
    
    const dt = Math.min(0.05, (timestamp - lastTime) / 1000);
    lastTime = timestamp;
    TIME.elapsed += dt;
    gameTime = TIME.elapsed; // keep phase clock in sync
    
    handleInput();
    
    // During dialogue, still render but pause simulation
    if (!dialogueActive) {
        const scale = greyline.knobs?.timeScale ?? 1.0;
        const simDt = dt * scale;
        greyline.update(simDt, { player, enemies, inventoryOpen, upgradeOpen, shopOpen, xp: xpSystem, inHub: isPlayerInHub() });
        // Perceptual time follows real time (using unscaled dt) so visual effects keep in sync
        TIME.percept += dt * scale;
        psychStats.update(simDt);
        player.update(simDt);
        inventory.update(simDt);
    }
    
    // Update game state based on player position
    const wasInHub = gameState === GameState.HUB;
    const nowInHub = isPlayerInHub();
    
    if (nowInHub && !wasInHub) {
        gameState = GameState.HUB;
        const areaName = document.getElementById('area-name');
        if (areaName) {
            areaName.innerHTML = '';
            areaName.textContent = 'The Holdfast';
            const sub = document.createElement('span');
            sub.id = 'area-subtitle';
            sub.textContent = 'a holding pattern, not a refuge';
            areaName.appendChild(sub);
            areaName.classList.remove('fade');
            areaName.classList.add('visible');
            setTimeout(() => {
                areaName.classList.remove('visible');
                areaName.classList.add('fade');
            }, 3000);
        }
        // Smooth auto-centering of the Greyline when entering the Holdfast — gentle, non-snapping.
        try {
            greyline.momentum += (0.5 - greyline.value) * 0.35; // immediate soft nudge toward centre
            greyline.visibleTimer = Math.min(2.0, (greyline.visibleTimer || 0) + 0.6);
        } catch (e) { /* defensive — greyline may not be initialized in some edge timing cases */ }
    } else if (!nowInHub && wasInHub) {
        gameState = GameState.EXPLORING;
        
        // ── FIRST EXIT: spawn enemies ──
        if (!hasExitedHub) {
            hasExitedHub = true;
            if (!enemiesSpawned) {
                spawnEnemies();
                enemiesSpawned = true;
            }
        }
        
        const areaName = document.getElementById('area-name');
        if (areaName) {
            areaName.innerHTML = '';
            areaName.textContent = 'The Verge';
            const sub = document.createElement('span');
            sub.id = 'area-subtitle';
            sub.textContent = 'where the world failed to move on';
            areaName.appendChild(sub);
            areaName.classList.remove('fade');
            areaName.classList.add('visible');
            setTimeout(() => {
                areaName.classList.remove('visible');
                areaName.classList.add('fade');
            }, 3000);
        }
    }
    
    // Enemies only update outside hub — hub is safe
    if (!dialogueActive) {
        for (const enemy of adaptiveArray(enemies)) {
            // Push enemies away from hub if they stray too close
            const hubX = WORLD_SIZE / 2;
            const hubY = WORLD_SIZE / 2;
            const dx = enemy.x - hubX;
            const dy = enemy.y - hubY;
            const eDistSq = dx * dx + dy * dy;
            if (eDistSq < HUB_SAFE_RADIUS * HUB_SAFE_RADIUS && !enemy.dead) {
                const eDist = Math.sqrt(eDistSq) || 1;
                const pushX = dx / eDist;
                const pushY = dy / eDist;
                enemy.x += pushX * 2 * dt;
                enemy.y += pushY * 2 * dt;
                continue;
            }
            enemy.update(dt);
        }

        enemies = enemies.filter(e => {
            if (!e.dead) return true;
            return e.deathTimer < 5;
        });
        
        updateParticles(dt);
        updateWorldDrops(dt);
    }
    
    // Respawn — only when exploring
    if (gameState === GameState.EXPLORING && !dialogueActive) {
        const aliveCount = enemies.filter(e => !e.dead).length;
        if (aliveCount < 8 && Math.random() < 0.005) {
            spawnWave();
        }
    }
    
    // Audio update
    if (audioEngine && audioEngine.started) {
        audioEngine.update(dt);
    }
    
    // Camera
    const pScreen = worldToScreen(player.x, player.y);
    camera.targetX = pScreen.x;
    camera.targetY = pScreen.y;
    camera.update();
    
    // Death — failure to persist. Return to hub.
    if (player.health <= 0 && !dialogueActive) {
        player.health = player.maxHealth * 0.3;
        player.burden += 15;
        player.x = WORLD_SIZE / 2;
        player.y = WORLD_SIZE / 2 + 2;
        greyline.value = 0.5;
        greyline.momentum = 0;
        gameState = GameState.HUB;
        
        const flash = document.getElementById('damage-flash');
        if (flash) {
            flash.style.background = 'rgba(0,0,0,0.8)';
            setTimeout(() => { flash.style.background = 'rgba(0,0,0,0)'; }, 800);
        }
    }
    
    // Burden overload
    if (player.burden >= player.maxBurden && !dialogueActive) {
        player.burden = player.maxBurden * 0.5;
        player.health -= 20;
        psychStats.agency.value -= 0.2;
        camera.addShake(10);
    }
    
    render();
    updateUI();
    input.clearFrame();
}

function spawnWave() {
    const hubX = WORLD_SIZE / 2;
    const hubY = WORLD_SIZE / 2;
    const types = ['lingering', 'lingering', 'huddled', 'huddled', 'huddled', 
                   'rehearsed', 'drifting', 'deferred'];
    const type = types[Math.floor(Math.random() * types.length)];
    const angle = Math.random() * Math.PI * 2;
    const dist = 15 + Math.random() * 15;
    
    const ex = hubX + Math.cos(angle) * dist;
    const ey = hubY + Math.sin(angle) * dist;
    
    if (type === 'huddled') {
        for (let i = 0; i < 3; i++) {
            enemies.push(new Enemy('huddled', 
                ex + (Math.random() - 0.5) * 2, 
                ey + (Math.random() - 0.5) * 2));
        }
    } else {
        enemies.push(new Enemy(type, ex, ey));
    }
}

// ============================================================
// INITIALIZATION — Title → Controls → Hub → Explore
// ============================================================
async function init() {
    input.init();
    installHouseTestMobileControls();
    
    // Start title screen immediately
    gameState = GameState.TITLE;
    initTitleScreen();

    // === TITLE SCREEN — click or keypress to proceed (register early so 'begin' works while assets load) ===
    const titleScreen = document.getElementById('title-screen');
    const controlsOverlay = document.getElementById('controls-overlay');
    let titleMusicStarted = false;
    let titleTransitioning = false;

    function tryStartTitleMusic() {
        if (titleMusicStarted) return;
        titleMusicStarted = true;
        console.log('[Audio] Starting title music on user gesture');
        ensureAudioUnlocked().then((ok) => {
            console.log('[Audio] ensureAudioUnlocked ->', ok, 'actx-state:', _actx && _actx.state);
            if (ok) {
                initTitleMusic();
            } else {
                // fallback: try HTMLAudio beep to detect blocked output
                try {
                    const a = new Audio();
                    a.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='; // tiny silent WAV (placeholder)
                    a.play().then(() => { console.warn('[Audio] HTMLAudio fallback beep played (AudioContext blocked)'); if (document.getElementById('audio-status')) document.getElementById('audio-status').innerText = 'Audio: fallback beep played'; }).catch(e => { console.error('[Audio] HTMLAudio fallback failed', e); if (document.getElementById('audio-status')) document.getElementById('audio-status').innerText = 'Audio: blocked'; });
                } catch (e) { console.error('[Audio] HTMLAudio fallback exception', e); }
            }
        });
    }

    // Allow other UI (sound button) to request title music without advancing the title
    document.addEventListener('title-music-request', tryStartTitleMusic);
    document.addEventListener('title-music-stop', () => {
        try {
            if (titleMusicEngine) { titleMusicEngine.fadeOut(); titleMusicEngine = null; }
        } catch (e) { /* ignore */ }
    });

    function handleTitleStart() {
        if (gameState !== GameState.TITLE || titleTransitioning) return;
        titleTransitioning = true;
        ensureAudioUnlocked();
        initAudio();
        if (titleMusicEngine) { titleMusicEngine.fadeOut(); setTimeout(() => { titleMusicEngine = null; }, 4000); }
        gameState = GameState.CONTROLS;
        if (titleScreen) { titleScreen.classList.add('fade'); setTimeout(() => { titleScreen.style.display = 'none'; }, 2500); }
        setTimeout(() => { if (controlsOverlay) controlsOverlay.classList.add('visible'); }, 1500);
    }

    function handleControlsDismiss() {
        if (gameState !== GameState.CONTROLS) return;
        gameState = GameState.HUB;
        if (controlsOverlay) { controlsOverlay.classList.add('fade'); setTimeout(() => { controlsOverlay.classList.remove('visible'); controlsOverlay.style.display = 'none'; }, 1500); }
        const uiOverlay = document.getElementById('ui-overlay'); if (uiOverlay) uiOverlay.classList.add('visible');
        const areaName = document.getElementById('area-name'); if (areaName) { setTimeout(() => areaName.classList.add('visible'), 500); setTimeout(() => { areaName.classList.remove('visible'); areaName.classList.add('fade'); }, 4000); }
        gameStarted = true; lastTime = performance.now(); console.log('[Audio] Game started — audioEngine ready:', audioEngine?.started);
    }

    // title demo helpers ------------------------------------------------
    function setupTitleDemoButtons() {
        const neutral = document.getElementById('demo-neutral');
        const comp = document.getElementById('demo-compulsion');
        const rest = document.getElementById('demo-restraint');
        [neutral, comp, rest].forEach(btn => {
            if (!btn) return;
            btn.addEventListener('click', e => {
                e.stopPropagation();
                tryStartTitleMusic();
                if (btn.id === 'demo-neutral') startTitleDemo('neutral');
                if (btn.id === 'demo-compulsion') startTitleDemo('compulsion');
                if (btn.id === 'demo-restraint') startTitleDemo('restraint');
            });
        });
    }
    // ----------------------------------------------------------------------

    // settings overlay logic
    let titleMasterGain = null;
    function showSettings() {
        const ov = document.getElementById('settings-overlay');
        if (!ov) return;
        ov.style.display = 'flex';
        // fill sliders
        document.getElementById('setting-bass').value = audioConfig.hubBassVolume;
        document.getElementById('setting-beat').value = audioConfig.subBassVolume;
        document.getElementById('setting-melody').value = audioConfig.hubMelodyVolume;
        document.getElementById('setting-pitch').value = audioConfig.pitchWarpStrength;
        document.getElementById('setting-pitchfactor').value = audioConfig.pitchFactor;
        document.getElementById('setting-basswarp').value = audioConfig.bassWarpStrength;
        document.getElementById('setting-harmony').value = audioConfig.neutralHarmony;
        document.getElementById('setting-tempo').value = audioConfig.tempoFactor;
        document.getElementById('setting-title').value = audioConfig.titleVolume;
        // neutral BPM display
        const nbEl = document.getElementById('setting-neutralbpm');
        if (nbEl) nbEl.value = audioConfig.neutralBpm || 100;
        const nbv = document.getElementById('neutralbpm-value');
        if (nbv) nbv.textContent = String(audioConfig.neutralBpm || 100);
    }
    function hideSettings() {
        const ov = document.getElementById('settings-overlay');
        if (!ov) return;
        ov.style.display = 'none';
    }
    function initSettingsUI() {
        const sliders = ['bass','beat','melody','pitch','pitchfactor','basswarp','harmony','tempo','title'];
        sliders.forEach(id => {
            const el = document.getElementById('setting-' + id);
            if (!el) return;
            el.addEventListener('input', () => {
                const val = parseFloat(el.value);
                switch(id) {
                    case 'bass': audioConfig.hubBassVolume = val; break;
                    case 'beat': audioConfig.subBassVolume = val; break;
                    case 'melody': audioConfig.hubMelodyVolume = val; break;
                    case 'pitch': audioConfig.pitchWarpStrength = val; break;
                    case 'pitchfactor': audioConfig.pitchFactor = val; break;
                    case 'basswarp': audioConfig.bassWarpStrength = val; break;
                    case 'harmony': audioConfig.neutralHarmony = val; break;
                    case 'tempo': audioConfig.tempoFactor = val; break;
                    case 'title': audioConfig.titleVolume = val; break;
                }
                saveAudioConfig();
                // apply immediately
                if (id === 'title' && titleMasterGain) titleMasterGain.gain.value = audioConfig.titleVolume;
            });
        });
        // neutral BPM handler
        const nb = document.getElementById('setting-neutralbpm');
        const nbv2 = document.getElementById('neutralbpm-value');
        if (nb) {
            nb.addEventListener('input', () => {
                const val = parseInt(nb.value || '100');
                audioConfig.neutralBpm = val;
                if (nbv2) nbv2.textContent = String(val);
                saveAudioConfig();
            });
        }
        // export/reset buttons
        const exp = document.getElementById('btn-export-config');
        if (exp) exp.addEventListener('click', () => {
            const blob = new Blob([JSON.stringify(audioConfig, null, 2)], {type:'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'audio-config.json';
            a.click();
            URL.revokeObjectURL(url);
        });
        const clr = document.getElementById('btn-clear-config');
        if (clr) clr.addEventListener('click', () => {
            localStorage.removeItem('audioConfig');
            Object.assign(audioConfig, {hubMelodyVolume:1,hubBassVolume:1,pitchWarpStrength:1,bassWarpStrength:1,titleVolume:1});
            showSettings();
        });
    }

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && (gameState === GameState.HUB || gameState === GameState.EXPLORING)) {
            const ov = document.getElementById('settings-overlay');
            if (ov && ov.style.display === 'flex') hideSettings();
            else showSettings();
        }
    });


    document.addEventListener('title-start', handleTitleStart);
    document.addEventListener('controls-dismiss', handleControlsDismiss);
    if (titleScreen) { 
        titleScreen.addEventListener('click', (e) => { console.log('[Title] screen clicked', e); tryStartTitleMusic(); handleTitleStart(); });
        setupTitleDemoButtons();
        initSettingsUI();
    }
    window.addEventListener('keydown', function titleKey(e) { if (gameState === GameState.TITLE) { tryStartTitleMusic(); handleTitleStart(); } else if (gameState === GameState.CONTROLS) { handleControlsDismiss(); window.removeEventListener('keydown', titleKey); } });

    // Load assets in background while title plays
    await loadImages();
    if (HOUSE_VARIANT_REVIEW) {
        try {
            const variant = await loadVariant();
            houseVariantMetadata = variant.metadata;
            loadedImages.houseA02 = variant.image;
        } catch (error) {
            console.error('[A-02 review refused]',error);
            const notice = document.createElement('div');
            notice.textContent = 'A-02 review refused: '+error.message;
            notice.style.cssText = 'position:fixed;top:10px;left:10px;z-index:99999;background:#300;color:white;padding:12px';
            document.body.appendChild(notice);
            return;
        }
    }
    createTilePatterns();
    world.generate();
    if (HOUSE_VARIANT_REVIEW) {
        const spawn=reviewLayout(WORLD_SIZE/2,WORLD_SIZE/2).player;
        player.x=spawn.x;player.y=spawn.y;
    }
    
    // Audio context will be created on first user gesture
    
    // Enemies spawn on first hub exit — not at init
    // The hasExitedHub flag in the game loop handles this
    
    // Give starting items
    giveStartingItems();
    
    const pScreen = worldToScreen(player.x, player.y);
    camera.x = pScreen.x;
    camera.y = pScreen.y;
    camera.targetX = pScreen.x;
    camera.targetY = pScreen.y;
    
    // Title listeners registered earlier (moved up so the title 'begin' button works while assets load)
    
    // Inventory toggle
    window.addEventListener('keydown', (e) => {
        if (gameState !== GameState.HUB && gameState !== GameState.EXPLORING) return;
        
        if (e.key === 'i' || e.key === 'I' || e.key === 'Tab') {
            e.preventDefault();
            if (upgradeOpen) { upgradeOpen = false; document.getElementById('upgrade-panel')?.classList.remove('visible'); }
            if (shopOpen) { closeShop(); }
            inventoryOpen = !inventoryOpen;
            const panel = document.getElementById('inventory-panel');
            if (panel) {
                if (inventoryOpen) {
                    panel.classList.add('visible');
                    inventory.updateUI();
                } else {
                    panel.classList.remove('visible');
                }
            }
        }
        // Upgrade panel toggle — P key
        if (e.key === 'p' || e.key === 'P') {
            if (inventoryOpen) { inventoryOpen = false; document.getElementById('inventory-panel')?.classList.remove('visible'); }
            if (shopOpen) { closeShop(); }
            upgradeOpen = !upgradeOpen;
            const panel = document.getElementById('upgrade-panel');
            if (panel) {
                if (upgradeOpen) {
                    panel.classList.add('visible');
                    updateUpgradeUI();
                } else {
                    panel.classList.remove('visible');
                }
            }
        }
        if (e.key === 'Escape') {
            if (shopOpen) {
                closeShop();
            } else if (activeDialogue) {
                dismissDialogue();
            } else if (upgradeOpen) {
                upgradeOpen = false;
                document.getElementById('upgrade-panel')?.classList.remove('visible');
            } else if (inventoryOpen) {
                inventoryOpen = false;
                document.getElementById('inventory-panel')?.classList.remove('visible');
            }
        }
    });

    // Allow player to explicitly hide when in haze: press Shift to enter hide state
    window.addEventListener('keydown', (e) => {
        try {
            if (gameState !== GameState.HUB && gameState !== GameState.EXPLORING) return;
            if (e.key === 'Shift' || e.key === 'ShiftLeft' || e.key === 'ShiftRight') {
                if (isPlayerInHaze() && player) {
                    // set to a moderate hide timer so draw logic triggers without maxing restraint
                    player._hideInFogTimer = Math.max(player._hideInFogTimer || 0, 4.0);
                    // Force immediate visual crouch feedback for a short moment
                    player._forceCrouch = true;
                    setTimeout(() => { try { if (player) player._forceCrouch = false; } catch(e){} }, 600);
                    // small particle and softer restraint nudge for feedback
                    try { particles.push({ x: player.x, y: player.y, vx: 0, vy: -0.2, type: 'haze_hide', timer: 1.2, size: 1.2 }); } catch(e){}
                    try { greyline.push(-1, 0.006); } catch(e){}
                    console.log('[HIDE] Player initiated hide (Shift) in haze — forced crouch');
                }
            }
        } catch(e) { /* ignore */ }
    });
    
    document.addEventListener('inv-close', () => {
        inventoryOpen = false;
        document.getElementById('inventory-panel')?.classList.remove('visible');
    });
    
    document.addEventListener('upgrade-close', () => {
        upgradeOpen = false;
        document.getElementById('upgrade-panel')?.classList.remove('visible');
    });
    
    document.addEventListener('shop-close', () => {
        closeShop();
    });
    
    // Dialogue dismiss from HTML onclick
    document.addEventListener('dialogue-dismiss', () => {
        if (activeDialogue) dismissDialogue();
    });
    
    // Fullscreen toggle — F11
    window.addEventListener('keydown', (e) => {
        if (e.key === 'F11') {
            e.preventDefault();
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
            } else {
                document.exitFullscreen().catch(() => {});
            }
        }
    });
    
    // Start the loop — it won't actually update until gameStarted
    requestAnimationFrame(gameLoop);
}

// ============================================================
// UPGRADE PANEL UI — Renders skill & passive upgrade options
// ============================================================
function updateUpgradeUI() {
    const pointsEl = document.getElementById('upgrade-points');
    if (pointsEl) pointsEl.textContent = `${progression.skillPoints} point${progression.skillPoints !== 1 ? 's' : ''} available`;
    
    // Skill upgrades
    const skillsContainer = document.getElementById('upgrade-skills');
    if (skillsContainer) {
        const skillImageMap = {
            predatory: 'skillPredatory', snare: 'skillSnare', reclaim: 'skillReclaim',
            attune: 'skillAttune', burdenShift: 'skillBurden', shadow: 'skillShadow',
        };
        
        skillsContainer.innerHTML = Object.entries(progression.skillUpgrades).map(([key, skill]) => {
            const imgUrl = ASSETS[skillImageMap[key]] || '';
            const isMaxed = skill.level >= skill.maxLevel;
            const canUpgrade = progression.skillPoints > 0 && !isMaxed;
            const nextDesc = isMaxed ? 'MASTERED' : (skill.desc[skill.level] || '');
            const pips = Array.from({length: skill.maxLevel}, (_, i) => 
                `<div class="upgrade-pip ${i < skill.level ? 'filled' : ''}"></div>`
            ).join('');
            
            return `<div class="upgrade-row">
                ${imgUrl ? `<img class="upgrade-icon" src="${imgUrl}" alt="${skill.name}">` : ''}
                <div class="upgrade-info">
                    <div class="upgrade-name">${skill.name}</div>
                    <div class="upgrade-desc">${nextDesc}</div>
                    <div class="upgrade-pips">${pips}</div>
                </div>
                <button class="upgrade-btn ${isMaxed ? 'maxed' : (!canUpgrade ? 'disabled' : '')}" 
                    onclick="handleSkillUpgrade('${key}')">${isMaxed ? 'MAX' : 'UPGRADE'}</button>
            </div>`;
        }).join('');
    }
    
    // Passive upgrades
    const passivesContainer = document.getElementById('upgrade-passives');
    if (passivesContainer) {
        passivesContainer.innerHTML = Object.entries(progression.passiveUpgrades).map(([key, passive]) => {
            const isMaxed = passive.level >= passive.maxLevel;
            const canUpgrade = progression.skillPoints > 0 && !isMaxed;
            const pips = Array.from({length: passive.maxLevel}, (_, i) => 
                `<div class="upgrade-pip ${i < passive.level ? 'filled' : ''}"></div>`
            ).join('');
            
            return `<div class="upgrade-row">
                <div class="upgrade-info">
                    <div class="upgrade-name">${passive.name} (${passive.level}/${passive.maxLevel})</div>
                    <div class="upgrade-desc">${passive.desc}</div>
                    <div class="upgrade-pips">${pips}</div>
                </div>
                <button class="upgrade-btn ${isMaxed ? 'maxed' : (!canUpgrade ? 'disabled' : '')}" 
                    onclick="handlePassiveUpgrade('${key}')">${isMaxed ? 'MAX' : 'UPGRADE'}</button>
            </div>`;
        }).join('');
    }
}

// Global handlers for upgrade buttons (accessible from onclick)
window.handleSkillUpgrade = function(key) {
    if (progression.upgradeSkill(key)) {
        updateUpgradeUI();
        // Play upgrade sound
        if (audioEngine && audioEngine.ctx) {
            const ctx = audioEngine.ctx;
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            osc.connect(gain);
            gain.connect(audioEngine.sfxBus || ctx.destination);
            osc.start(now);
            osc.stop(now + 0.3);
        }
    }
};

window.handlePassiveUpgrade = function(key) {
    if (progression.upgradePassive(key)) {
        updateUpgradeUI();
        if (audioEngine && audioEngine.ctx) {
            const ctx = audioEngine.ctx;
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(330, now);
            osc.frequency.exponentialRampToValueAtTime(660, now + 0.2);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
            osc.connect(gain);
            gain.connect(audioEngine.sfxBus || ctx.destination);
            osc.start(now);
            osc.stop(now + 0.35);
        }
    }
};

// ============================================================
// LEVEL UP SOUND — Triumphant ascending chime
// ============================================================
function playLevelUpSound() {
    if (!audioEngine || !audioEngine.ctx) return;
    const ctx = audioEngine.ctx;
    const now = ctx.currentTime;
    const dest = audioEngine.sfxBus || ctx.destination;
    
    // Ascending chord: C5 E5 G5 C6
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = i < 2 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.12, now + i * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(now + i * 0.08);
        osc.stop(now + 1.2);
    });
    
    // Shimmer noise burst
    const bufSize = ctx.sampleRate * 0.4;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.02;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.08, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3000;
    filter.Q.value = 2;
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(dest);
    noise.start(now);
    noise.stop(now + 0.5);
}

// ============================================================
// SETTINGS MENU — ESC to toggle, audio sliders
// ============================================================
let settingsOpen = false;

function openSettings() {
    settingsOpen = true;
    const panel = document.getElementById('settings-panel');
    if (panel) {
        panel.classList.add('visible');
        document.getElementById('slider-master').value = audioSettings.master * 100;
        document.getElementById('slider-music').value = audioSettings.music * 100;
        document.getElementById('slider-sfx').value = audioSettings.sfx * 100;
        document.getElementById('slider-ambient').value = audioSettings.ambient * 100;
    }
}

function closeSettings() {
    settingsOpen = false;
    const panel = document.getElementById('settings-panel');
    if (panel) panel.classList.remove('visible');
}

window.updateAudioSetting = function(key, value) {
    audioSettings[key] = value / 100;
    if (audioEngine && audioEngine.applySettings) audioEngine.applySettings();
    // Update label
    const label = document.getElementById('val-' + key);
    if (label) label.textContent = value + '%';
};

// ============================================================
// QUEST SYSTEM — Kill quests + Boss quest
// ============================================================
const questSystem = {
    quests: [
        {
            id: 'cull_lingering',
            name: 'Culling the Hesitant',
            desc: "Dispatch 5 Lingering husks. They avoid confrontation — don't let them.",
            giver: 'The Keeper',
            giverNpc: 'keeper',
            type: 'kill',
            targetType: 'lingering',
            targetCount: 5,
            current: 0,
            reward: { gold: 30, insight: 25 },
            state: 'available',
        },
        {
            id: 'silence_watchers',
            name: 'Blind the Perimeter',
            desc: 'Destroy 4 Watchful sentinels. Their vigil serves no one.',
            giver: 'Veiled Oren',
            giverNpc: 'watcher',
            type: 'kill',
            targetType: 'watchful',
            targetCount: 4,
            current: 0,
            reward: { gold: 40, insight: 35 },
            state: 'available',
        },
        {
            id: 'scatter_huddled',
            name: 'Scatter the Cluster',
            desc: 'Break apart 8 Huddled. Togetherness without purpose is just mass.',
            giver: 'Harren',
            giverNpc: 'scholar',
            type: 'kill',
            targetType: 'huddled',
            targetCount: 8,
            current: 0,
            reward: { gold: 25, insight: 30 },
            state: 'available',
        },
        {
            id: 'hollow_warden',
            name: 'The Hollow Warden',
            desc: "A massive entity anchors the Verge's deepest wound. Find and confront it in the far reaches.",
            giver: 'Harren',
            giverNpc: 'scholar',
            type: 'kill_boss',
            targetType: 'hollow_warden',
            targetCount: 1,
            current: 0,
            reward: { gold: 150, insight: 100 },
            state: 'locked',
        },
    ],

    logOpen: false,

    getActive() { return this.quests.filter(q => q.state === 'active'); },
    getAvailable() { return this.quests.filter(q => q.state === 'available'); },
    getComplete() { return this.quests.filter(q => q.state === 'complete'); },

    accept(questId) {
        const q = this.quests.find(q2 => q2.id === questId);
        if (q && q.state === 'available') {
            q.state = 'active';
            q.current = 0;
            this.showNotification('Quest accepted: ' + q.name);
            // Spawn boss if accepting the boss quest
            if (q.id === 'hollow_warden') spawnBoss();
        }
    },

    onEnemyKill(enemyType) {
        for (const q of this.quests) {
            if (q.state !== 'active') continue;
            if ((q.type === 'kill' || q.type === 'kill_boss') && q.targetType === enemyType) {
                q.current = Math.min(q.current + 1, q.targetCount);
                if (q.current >= q.targetCount) {
                    q.state = 'complete';
                    this.showNotification('Quest complete: ' + q.name + '!');
                    this.checkBossUnlock();
                }
            }
        }
    },

    checkBossUnlock() {
        const bossQ = this.quests.find(q => q.id === 'hollow_warden');
        if (!bossQ || bossQ.state !== 'locked') return;
        const others = this.quests.filter(q => q.id !== 'hollow_warden');
        const allDone = others.every(q => q.state === 'complete' || q.state === 'turned_in');
        if (allDone) {
            bossQ.state = 'available';
            this.showNotification('A tremor in the Verge... something awakens.');
        }
    },

    turnIn(questId) {
        const q = this.quests.find(q2 => q2.id === questId);
        if (q && q.state === 'complete') {
            q.state = 'turned_in';
            if (q.reward.gold) economy.addGold(q.reward.gold);
            if (q.reward.insight) {
                progression.insightCurrent += q.reward.insight;
                progression.insightTotal += q.reward.insight;
                while (progression.insightCurrent >= progression.insightToNext) {
                    progression.levelUp();
                }
            }
            this.showNotification('Reward: ' + q.reward.gold + ' gold, ' + q.reward.insight + ' insight');
        }
    },

    _notification: null,
    _notifTimer: 0,
    showNotification(text) {
        this._notification = text;
        this._notifTimer = 4.5;
    },
    updateNotification(dt) {
        if (this._notifTimer > 0) this._notifTimer -= dt;
        else this._notification = null;
    },
};

// ── QUEST LOG UI ──
function updateQuestLogUI() {
    const panel = document.getElementById('quest-log');
    if (!panel) return;
    let html = '';
    for (const q of questSystem.quests) {
        if (q.state === 'turned_in') continue;
        if (q.state === 'locked') continue;
        const stateLabel = q.state === 'available' ? '<span style="color:#b8a870">AVAILABLE</span>'
            : q.state === 'active' ? '<span style="color:#90b070">ACTIVE</span>'
            : q.state === 'complete' ? '<span style="color:#e0c050">COMPLETE</span>' : '';
        const progress = (q.state === 'active' || q.state === 'complete')
            ? `<div class="quest-progress">${q.current}/${q.targetCount}</div>` : '';
        const actions = q.state === 'available'
            ? `<button class="quest-btn" onclick="questSystem.accept('${q.id}');updateQuestLogUI()">Accept</button>`
            : '';
        html += `<div class="quest-entry ${q.state}">
            <div class="quest-name">${q.name} ${stateLabel}</div>
            <div class="quest-desc">${q.desc}</div>
            <div class="quest-reward">Reward: ${q.reward.gold}g / ${q.reward.insight} insight</div>
            ${progress}${actions}
        </div>`;
    }
    if (!html) html = '<div class="quest-empty">No quests available</div>';
    document.getElementById('quest-list').innerHTML = html;
}

// ── BOSS: The Hollow Warden ──
let bossSpawned = false;
let bossEntity = null;

function spawnBoss() {
    if (bossSpawned) return;
    bossSpawned = true;
    const hubX = WORLD_SIZE / 2, hubY = WORLD_SIZE / 2;
    const angle = Math.PI * 0.25 + (Math.random() - 0.5) * 0.5; // NE-ish
    const dist = 28 + Math.random() * 6;
    const bx = hubX + Math.cos(angle) * dist;
    const by = hubY + Math.sin(angle) * dist;
    bossEntity = new Enemy('hollow_warden', bx, by);
    enemies.push(bossEntity);
    camera.addShake(6);
}

// ── MINIMAP — Bottom-right, shows player, enemies, quest markers ──
function renderMinimap() {
    const W = canvas.width, H = canvas.height;
    const rawScale = Math.min(W / 1920, H / 1080);
    const s = Math.max(0.85, rawScale * 1.35);
    const size = Math.round(110 * s);
    const mx = W - size - Math.round(16 * s);
    const my = H - size - Math.round(90 * s);
    const cxW = WORLD_SIZE / 2, cyW = WORLD_SIZE / 2;
    const mapScale = size / WORLD_SIZE;

    ctx.save();
    ctx.globalAlpha = 0.75;

    // Bg circle
    ctx.fillStyle = 'rgba(8,7,6,0.85)';
    ctx.beginPath();
    ctx.arc(mx + size / 2, my + size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(100,85,60,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Clip
    ctx.beginPath();
    ctx.arc(mx + size / 2, my + size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = 0.9;

    // Hub
    const hubR = HUB_SAFE_RADIUS * mapScale;
    ctx.fillStyle = 'rgba(60,50,35,0.45)';
    ctx.beginPath();
    ctx.arc(mx + cxW * mapScale, my + cyW * mapScale, hubR, 0, Math.PI * 2);
    ctx.fill();

    // Boundary ring
    ctx.strokeStyle = 'rgba(80,40,40,0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.arc(mx + cxW * mapScale, my + cyW * mapScale, 42 * mapScale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Trees
    for (let i = 0; i < world.props.length; i += 3) {
        const p = world.props[i];
        if (p.type === 'deadTree1' || p.type === 'deadTree2') {
            ctx.fillStyle = 'rgba(50,60,40,0.35)';
            ctx.fillRect(mx + p.x * mapScale - 0.5, my + p.y * mapScale - 0.5, 1.5, 1.5);
        }
    }

    // Enemies (fog of war: only within ~22 tiles)
    for (const e of enemies) {
        if (e.dead) continue;
        const ed = Math.sqrt((e.x - player.x) ** 2 + (e.y - player.y) ** 2);
        if (ed > 22) continue;
        if (e.type === 'hollow_warden') {
            ctx.fillStyle = '#e55';
            ctx.beginPath();
            ctx.arc(mx + e.x * mapScale, my + e.y * mapScale, 3, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillStyle = 'rgba(180,80,60,0.65)';
            ctx.fillRect(mx + e.x * mapScale - 1, my + e.y * mapScale - 1, 2, 2);
        }
    }

    // Quest turn-in markers
    for (const q of questSystem.getComplete()) {
        const npc = world.npcs.find(n => n.id === q.giverNpc);
        if (npc) {
            const nx = mx + npc.x * mapScale, ny = my + npc.y * mapScale;
            const pulse = 0.7 + Math.sin(TIME.elapsed * 3) * 0.3;
            ctx.fillStyle = `rgba(240,210,60,${pulse})`;
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('?', nx, ny + 3);
        }
    }
    // Quest giver markers (available)
    for (const q of questSystem.getAvailable()) {
        const npc = world.npcs.find(n => n.id === q.giverNpc);
        if (npc) {
            const nx = mx + npc.x * mapScale, ny = my + npc.y * mapScale;
            ctx.fillStyle = 'rgba(240,210,60,0.6)';
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('!', nx, ny + 3);
        }
    }
    // Boss marker for active boss quest
    if (bossEntity && !bossEntity.dead) {
        const bq = questSystem.quests.find(q => q.id === 'hollow_warden');
        if (bq && bq.state === 'active') {
            const bsx = mx + bossEntity.x * mapScale;
            const bsy = my + bossEntity.y * mapScale;
            const pulse = Math.sin(TIME.elapsed * 4) * 2;
            ctx.fillStyle = '#f44';
            ctx.beginPath();
            ctx.moveTo(bsx, bsy - 5 - pulse);
            ctx.lineTo(bsx + 3, bsy);
            ctx.lineTo(bsx, bsy + 5 + pulse);
            ctx.lineTo(bsx - 3, bsy);
            ctx.closePath();
            ctx.fill();
        }
    }

    // Player dot
    const px = mx + player.x * mapScale;
    const py = my + player.y * mapScale;
    ctx.fillStyle = '#c8b888';
    ctx.beginPath();
    ctx.arc(px, py, 2.5, 0, Math.PI * 2);
    ctx.fill();
    const dirA = player.moveAngle || 0;
    ctx.strokeStyle = '#c8b888';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(dirA) * 5, py + Math.sin(dirA) * 5);
    ctx.stroke();

    ctx.restore();
}

// ── QUEST NOTIFICATION RENDERER ──
function renderQuestNotification() {
    if (!questSystem._notification || questSystem._notifTimer <= 0) return;
    const W = canvas.width;
    // Compute visible top so the notification appears inside the cropped view
    const displayScale = Math.max(window.innerWidth / FIXED_CANVAS_W, window.innerHeight / FIXED_CANVAS_H);
    const visibleCanvasH = window.innerHeight / displayScale; // in internal canvas pixels
    const visibleTop = Math.round((canvas.height - visibleCanvasH) / 2);
    const notifY = visibleTop + 60;

    const alpha = Math.min(1, questSystem._notifTimer, questSystem._notifTimer > 3.5 ? (4.5 - questSystem._notifTimer) * 2 : 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 15px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(240,210,140,0.95)';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 6;
    ctx.fillText(questSystem._notification, W / 2, notifY);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
}

init();

// Expose a global reset so you can reset the app from console or UI
window.resetApp = function resetApp(hard = true) {
    console.log('[App] reset requested', hard ? '(hard reload)' : '(soft)');
    try { if (titleMusicEngine) { titleMusicEngine.fadeOut(); titleMusicEngine = null; } } catch(e){}
    try { if (_actx && typeof _actx.suspend === 'function') _actx.suspend(); } catch(e){}
    if (hard) {
        setTimeout(() => { window.location.reload(); }, 100);
    }
};

// --- Title music enable button handler ---
function setupTitleMusicButton(){
    try {
        const btn = document.getElementById('sound-button');
        if (!btn) return;
        // small status indicator next to the sound button for debugging/playback feedback
        let audioStatus = document.getElementById('audio-status');
        if (!audioStatus) {
            audioStatus = document.createElement('span');
            audioStatus.id = 'audio-status';
            audioStatus.style.marginLeft = '10px';
            audioStatus.style.fontSize = '11px';
            audioStatus.style.color = 'rgba(200,200,200,0.8)';
            audioStatus.style.pointerEvents = 'none';
            btn.parentNode && btn.parentNode.insertBefore(audioStatus, btn.nextSibling);
        }
        // create tiny meter bar
        if (!document.getElementById('audio-meter')) {
            const meter = document.createElement('div');
            meter.id = 'audio-meter';
            meter.style.position = 'absolute';
            meter.style.bottom = '18px';
            meter.style.right = '340px';
            meter.style.width = '120px';
            meter.style.height = '8px';
            meter.style.background = 'rgba(0,0,0,0.6)';
            meter.style.border = '1px solid rgba(255,255,255,0.2)';
            meter.style.pointerEvents = 'none';
            const fill = document.createElement('div');
            fill.id = 'audio-meter-fill';
            fill.style.width = '0%';
            fill.style.height = '100%';
            fill.style.background = '#0f0';
            meter.appendChild(fill);
            btn.parentNode && btn.parentNode.insertBefore(meter, audioStatus.nextSibling);
        }
        let enabled = false; let musicStartAttempts = 0;

        const enableSound = () => {
            // Ensure audio unlocked then start the title-music engine directly — does not advance the title
            musicStartAttempts = 0;
            ensureAudioUnlocked().then((ok) => {
                const ctx = getAudioCtx();
                if (audioStatus) audioStatus.innerText = 'Audio: unlocked';
                // Play a very short, quiet tone to guarantee output is audible (user-gesture confirmed)
                try {
                    const g = ctx.createGain();
                    g.gain.value = 0.6;                      // much louder test beep
                    g.connect(ctx.destination);
                    const o = ctx.createOscillator();
                    o.type = 'sine';
                    o.frequency.value = 440;
                    o.connect(g);
                    o.start();
                    setTimeout(() => { try { o.stop(); g.disconnect(); } catch(_){} }, 350);
                    // also play a short burst of white noise for guaranteed audibility
                    try {
                        const noiseGain = ctx.createGain();
                        noiseGain.gain.value = 0.4;
                        noiseGain.connect(ctx.destination);
                        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
                        const data = buf.getChannelData(0);
                        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
                        const src = ctx.createBufferSource();
                        src.buffer = buf;
                        src.connect(noiseGain);
                        src.start();
                        setTimeout(() => { try { src.stop(); noiseGain.disconnect(); } catch(_){} }, 320);
                    } catch(e) {}
                } catch (e) {}

                // Start title music; retry a couple times if the engine wasn't created (some browsers are finicky)
                function tryStartMusic() {
                    try { initTitleMusic(); } catch (e) { console.warn('initTitleMusic failed', e); }
                    musicStartAttempts++;
                    setTimeout(() => {
                        if (!titleMusicEngine && musicStartAttempts < 3) {
                            console.warn('[Audio] retrying title music start', musicStartAttempts);
                            tryStartMusic();
                        } else if (!titleMusicEngine) {
                            console.error('[Audio] title music failed to start after retries');
                            btn.textContent = 'Sound: Failed';
                            btn.classList.add('error');
                            if (audioStatus) audioStatus.innerText = 'Audio: failed to start';

                            // Final audible sanity test (try a tiny oscillator) to help diagnose browser blocks
                            try {
                                const ctx2 = getAudioCtx();
                                const g2 = ctx2.createGain(); g2.gain.value = 0.06; g2.connect(ctx2.destination);
                                const o2 = ctx2.createOscillator(); o2.type = 'sine'; o2.frequency.value = 660; o2.connect(g2);
                                o2.start();
                                setTimeout(() => { try { o2.stop(); g2.disconnect(); if (audioStatus) audioStatus.innerText = 'Audio: beep played (engine failed)'; } catch(_){} }, 180);
                            } catch (e) {
                                if (audioStatus) audioStatus.innerText = 'Audio: blocked (no output)';
                            }
                        } else {
                            btn.textContent = 'Sound: On';
                            btn.classList.remove('error');
                            btn.classList.add('on');
                            if (audioStatus) audioStatus.innerText = 'Audio: playing';
                        }
                    }, 220);
                }
                setTimeout(tryStartMusic, 120);
            });
            enabled = true;
        };

        const disableSound = () => {
            document.dispatchEvent(new CustomEvent('title-music-stop'));
            enabled = false;
            btn.textContent = 'Sound: Off';
            btn.classList.remove('on');
        };

        btn.addEventListener('click', (ev) => {
            ev.stopPropagation(); ev.preventDefault();
            if (!enabled) enableSound(); else disableSound();
        }, { passive: false });

        // Prevent clicks/touches from bubbling to title-start handlers so button doesn't progress the title
        btn.addEventListener('mousedown', (e) => e.stopPropagation());
        btn.addEventListener('touchstart', (e) => e.stopPropagation());

        // debug/reset buttons removed for release
    } catch (e) {
        console.warn('Sound button setup failed', e);
    }
}
setupTitleMusicButton();