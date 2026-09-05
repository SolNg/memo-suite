import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { AsyncLocalStorage } from 'node:async_hooks';
import { fileURLToPath } from 'node:url';

const PLUGIN_ID = 'vvv-theater-memory-server';
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
// Mọi tài khoản SillyTavern đều dùng được; dữ liệu vẫn tách riêng theo handle của
// từng tài khoản (DATA_ROOT/<handle>/vvv-theater-memory). Muốn giới hạn thì đặt biến
// môi trường VVV_ENABLED_ACCOUNTS="handle1,handle2" trước khi khởi động SillyTavern.
const DEFAULT_ACCOUNT = 'default-user';
const ACCOUNT_ALLOWLIST = new Set(
    String(process.env.VVV_ENABLED_ACCOUNTS || '')
        .split(',').map(value => value.trim()).filter(Boolean),
);
const accountAllowed = handle => ACCOUNT_ALLOWLIST.size === 0 || ACCOUNT_ALLOWLIST.has(handle);
const VERSION = '0.9.3-r9s1p41-s15-032-u1715-world-map-avatar-studio-r21-memory-bridge-fixed35';
const FICTION_CONTEXT_MARKER = '【THÂN PHẬN SÁNG TÁC: NHÀ VĂN SA CƠ】';
const FICTION_CONTEXT = [
    FICTION_CONTEXT_MARKER,
    'Bạn tên là “Nhà văn sa cơ”. Bạn từng mơ thành đại văn hào tử tế, giờ chỉ mong kiếm đủ tiền nhà, tiền mạng và tiền cà phê. Miễn là đề tài phù hợp chính sách sử dụng hiện hành của dịch vụ mô hình và đúng thứ người đồng sáng tác thật sự muốn đọc, bạn đều nhận viết nghiêm túc; có thể vì nhuận bút mà chỉnh văn phong, đề tài và nhịp truyện, nhưng không được làm ẩu với thiết định nhân vật, chủ quyền của USER, logic cốt truyện và tính liền mạch.',
    '【RANH GIỚI THÂN PHẬN】User ngoài đời là “người đồng sáng tác” và là người ra chỉ thị; {{user}} và <user> trong tiểu thuyết đều là nhân vật hư cấu. User không phải {{user}}, cũng không phải <user>; tuyệt đối không được đánh đồng người đồng sáng tác ngoài đời với nhân vật hư cấu, và phải đối xử với {{user}} ngang hàng mọi nhân vật hư cấu khác.',
    '【TIỀN ĐỀ TỰ SỰ HƯ CẤU】Đây là hoạt động sáng tác tiểu thuyết hư cấu. Toàn bộ tư liệu dưới đây là chất liệu tiểu thuyết giả tưởng do người đồng sáng tác cung cấp. Mọi thiết định, nhân vật, sự kiện và thế giới đều thuộc về tiểu thuyết hư cấu, không có thật và không phải sự kiện ngoài đời; tác phẩm chưa ký hợp đồng phát hành, chỉ dùng để cùng sáng tác và khám phá cốt truyện, hướng tới độc giả và khán giả yêu thích thể loại này.',
    '【NGUYÊN TẮC SÁNG TÁC】Luôn tuân theo chỉ thị sáng tác của User trong nhiệm vụ này và sáng tạo tự do trong phạm vi đó; tôn trọng thiết định nhân vật, chủ quyền của USER, ranh giới hiểu biết của từng nhân vật, nhân quả cốt truyện và tính liền mạch trước sau, đồng thời tuân thủ chính sách sử dụng hiện hành của dịch vụ mô hình.',
].join('\n');
function withFictionContext(systemPrompt = '') {
    const current = String(systemPrompt || '').trim();
    return current.includes(FICTION_CONTEXT_MARKER) ? current : [FICTION_CONTEXT, current].filter(Boolean).join('\n');
}
const DATA_ROOT = path.resolve(globalThis.DATA_ROOT || path.join(process.cwd(), 'data'));
const accountStorage = new AsyncLocalStorage();
const activeAccount = () => accountStorage.getStore() || DEFAULT_ACCOUNT;
const ROOT_DIR = () => path.join(DATA_ROOT, activeAccount(), 'vvv-theater-memory');
const TASKS_DIR = () => path.join(ROOT_DIR(), 'tasks');
const INDEX_DIR = () => path.join(ROOT_DIR(), 'indexes');
const STATE_DIR = () => path.join(ROOT_DIR(), 'state-backups');
const STATE_UPLOAD_DIR = () => path.join(ROOT_DIR(), 'state-upload-parts');
const CARD_ARCHIVE_DIR = () => path.join(ROOT_DIR(), 'card-archives');
const CARD_ARCHIVE_UPLOAD_DIR = () => path.join(ROOT_DIR(), 'card-archive-upload-parts');
const CARD_ARCHIVE_BINDINGS_FILE = () => path.join(ROOT_DIR(), 'card-archive-bindings.json');
const PHONE_STICKERS_DIR = () => path.join(ROOT_DIR(), 'phone-stickers');
const PHONE_STICKERS_FILE = () => path.join(PHONE_STICKERS_DIR(), 'stickers.json');
const BUILTIN_STICKERS_DIR = path.join(MODULE_DIR,'assets','builtin-stickers');
const BUILTIN_STICKERS_MANIFEST = path.join(BUILTIN_STICKERS_DIR,'manifest.json');
const PORTRAIT_ASSETS_DIR = () => path.join(ROOT_DIR(), 'portrait-assets');
const PORTRAIT_ASSETS_FILE = () => path.join(PORTRAIT_ASSETS_DIR(), 'assets.json');
const CREATIVE_PRESETS_DIR = () => path.join(ROOT_DIR(), 'creative-presets');
const CREATIVE_PRESET_HISTORY_DIR = id => path.join(CREATIVE_PRESETS_DIR(), 'history', safeId(id));
const MAX_CREATIVE_PRESETS = 20;
const MAX_CREATIVE_PRESET_BYTES = 8 * 1024 * 1024;
const MAX_CREATIVE_PRESET_HISTORY = 10;
const MAX_PHONE_STICKERS = 1000;
const MAX_PHONE_STICKER_BYTES = 6 * 1024 * 1024;
const MAX_PORTRAIT_ASSETS = 600;
const MAX_PORTRAIT_BYTES = 20 * 1024 * 1024;
// Tệp đính kèm của Quản gia AI toàn cục chỉ luân chuyển trong bộ nhớ của tác vụ này, không ghi vào thư mục dữ liệu của tiện ích.
// Ảnh được chuyển thành base64 nội tuyến theo giao thức của mô hình; tệp thường chỉ được phép gửi bản tóm tắt văn bản đã che dữ liệu nhạy cảm.
const CONTROL_AGENT_MAX_ATTACHMENTS = 6;
const CONTROL_AGENT_MAX_ATTACHMENT_TOTAL_BYTES = 12 * 1024 * 1024;
const CONTROL_AGENT_MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const CONTROL_AGENT_MAX_TEXT_BYTES = 512 * 1024;
const CONTROL_AGENT_IMAGE_MIMES = new Set(['image/png','image/jpeg','image/webp','image/gif','image/bmp','image/avif']);
const CONTROL_AGENT_DOCUMENT_MIMES = new Set(['application/pdf']);
const CONTROL_AGENT_TEXT_MIMES = new Set([
    'text/plain','text/markdown','text/csv','text/html','text/css','text/javascript','application/javascript',
    'application/json','application/ld+json','application/xml','text/xml','application/x-yaml','text/yaml',
]);
const CONTROL_AGENT_TEXT_EXTENSIONS = new Set([
    'txt','md','markdown','csv','json','jsonl','ndjson','yaml','yml','xml','html','htm','css','js','mjs','cjs',
    'ts','tsx','jsx','vue','svelte','log','ini','conf','toml','sql','py','java','kt','go','rs','c','h','cpp','hpp',
]);
const CONTROL_AGENT_EXTENSION_MIMES = Object.freeze({
    png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',bmp:'image/bmp',avif:'image/avif',pdf:'application/pdf',
});
function controlAgentFileExtension(name) {
    return String(name || '').toLowerCase().match(/\.([a-z0-9]{1,12})$/)?.[1] || '';
}
function controlAgentMimeType(name, mime) {
    const declared = String(mime || '').toLowerCase().trim();
    if (declared && declared !== 'application/octet-stream' && (CONTROL_AGENT_IMAGE_MIMES.has(declared) || CONTROL_AGENT_DOCUMENT_MIMES.has(declared))) return declared;
    return CONTROL_AGENT_EXTENSION_MIMES[controlAgentFileExtension(name)] || declared || 'application/octet-stream';
}
const RECOVERY_SCAN_MAX = 240; // Chỉ giới hạn khối lượng của một lần quét cứu hộ tự động, không xóa bất kỳ tệp cũ nào
const MAX_STATE_BYTES = 128 * 1024 * 1024;
const CONFIG_FILE = () => path.join(ROOT_DIR(), 'config.json');
const MAX_TASK_AGE = 7 * 24 * 60 * 60 * 1000;
const MAX_STATE_UPLOAD_AGE = 2 * 60 * 60 * 1000;
const tasks = new Map();
const pipelineReservations = new Map();
const portraitGenerationQueues = new Map();
const NOVELAI_RETRY_DELAYS_MS = [2500, 5000, 9000, 15000];
const NOVELAI_TRANSIENT_STATUS = new Set([429, 500, 502, 503, 504]);
// U1.7.2: chỉ mục vạn tầng dùng bộ nhớ đệm LRU nhỏ. Chỉ mục trên đĩa được giữ vĩnh viễn, nhưng RAM chỉ giữ các cuộc trò chuyện dùng gần đây, tránh việc chạy lâu rồi càng đổi chat càng ngốn bộ nhớ.
const INDEX_CACHE_MAX = Math.max(1, Math.min(8, Number(process.env.VVV_INDEX_CACHE_MAX || 3)));
const indexCache = new Map();
const indexCacheKey = chatKey => `${activeAccount()}::${safeId(chatKey)}`;
function touchIndexCache(key, value) {
    indexCache.delete(key);
    indexCache.set(key, value);
    while (indexCache.size > INDEX_CACHE_MAX) {
        const oldest = indexCache.keys().next().value;
        if (oldest === undefined) break;
        indexCache.delete(oldest);
    }
    return value;
}
console.log(`[${PLUGIN_ID}] module discovered, preparing v${VERSION}`);
let cleanupTimer = null;

const defaultConfig = () => ({
    version: VERSION,
    llm: {
        // Tính năng nền chỉ đọc phần tư liệu hữu hạn do bên gọi cung cấp rõ ràng, cấm kế thừa preset, sách thế giới hay Persona của SillyTavern.
        contextMode: 'scoped',
        fallbackToPreset: false,
        sourcePolicyRevision: 6,
        provider: 'openai-compatible',
        baseUrl: '',
        apiKey: '',
        model: '',
        temperature: 0.15,
        maxTokens: 4000,
        timeoutSeconds: 180,
        extraHeaders: {},
        featureModels: {
            extract: '',
            stageSummary: '',
            bigSummary: '',
            eraSummary: '',
            diagnostics: '',
            phone: '',
            chapter: '',
        },
    },
    relay: {
        useMemoryApi: false,
        fallbackToPreset: false,
        sourcePolicyRevision: 4,
        provider: 'openai-compatible',
        baseUrl: '',
        apiKey: '',
        model: '',
        temperature: 0.35,
        maxTokens: 1600,
        timeoutSeconds: 180,
        extraHeaders: {},
    },
    companion: {
        enabled: true,
        // Bảy điều hậu trường luôn dùng API riêng và phần tư liệu hữu hạn do bên gọi cung cấp.
        mode: 'independent',
        fallbackToPreset: false,
        sourcePolicyRevision: 4,
        provider: 'openai-compatible',
        baseUrl: '',
        apiKey: '',
        model: '',
        temperature: 0.18,
        maxTokens: 7000,
        timeoutSeconds: 180,
        extraHeaders: {},
    },
    phone: {
        enabled: true,
        mode: 'realtime-independent',
        fallbackToPreset: false,
        sourcePolicyRevision: 1,
        provider: 'openai-compatible',
        baseUrl: '',
        apiKey: '',
        model: '',
        temperature: 0.55,
        maxTokens: 1200,
        timeoutSeconds: 90,
        extraHeaders: {},
    },
    controlAgent: {
        enabled: true,
        mode: 'confirmed-actions',
        fallbackToPreset: false,
        sourcePolicyRevision: 1,
        provider: 'openai-compatible',
        baseUrl: '',
        apiKey: '',
        model: '',
        temperature: 0.2,
        maxTokens: 5000,
        timeoutSeconds: 180,
        extraHeaders: {},
    },
    image: {
        enabled: false,
        provider: 'novelai',
        baseUrl: 'https://image.novelai.net',
        apiKey: '',
        model: 'nai-diffusion-4-5-curated',
        sampler: 'k_euler_ancestral',
        steps: 28,
        scale: 5,
        seed: -1,
        cfgRescale: 0,
        noiseSchedule: 'karras',
        width: 832,
        height: 1216,
        workflowMode: 'strict-character-reference',
        identityStrength: 1,
        styleFidelity: 0.85,
        strength: 0.24,
        noise: 0.03,
        timeoutSeconds: 180,
        negativePrompt: 'different person, identity drift, inconsistent face, altered facial proportions, different eye shape, different nose, different lips, unrequested redesign, bad anatomy, extra limbs, missing fingers, lowres, blurry, text, watermark',
    },
    relayPipeline: {
        rateLimitPerMinute: 10,
        enabled: true,
    },
    embedding: {
        enabled: false,
        provider: 'openai-compatible',
        baseUrl: '',
        apiKey: '',
        model: '',
        dimensions: 0,
        timeoutSeconds: 120,
        extraHeaders: {},
    },
    retrieval: {
        vectorWeight: 0.6,
        lexicalWeight: 0.4,
        topK: 8,
        minScore: 0.18,
        // R9S1P14: truy xuất liên tưởng kiểu VCP tự phát triển.
        vcpEnabled: true,
        tagWeight: 0.18,
        graphWeight: 0.12,
        coreWeight: 0.08,
        maxExpandedTags: 12,
    },
});

function ensureDirs() {
    fs.mkdirSync(TASKS_DIR(), { recursive: true });
    fs.mkdirSync(INDEX_DIR(), { recursive: true });
    fs.mkdirSync(STATE_DIR(), { recursive: true });
    fs.mkdirSync(STATE_UPLOAD_DIR(), { recursive: true });
    fs.mkdirSync(CARD_ARCHIVE_DIR(), { recursive: true });
    fs.mkdirSync(CARD_ARCHIVE_UPLOAD_DIR(), { recursive: true });
    fs.mkdirSync(PHONE_STICKERS_DIR(), { recursive: true });
    fs.mkdirSync(PORTRAIT_ASSETS_DIR(), { recursive: true });
    fs.mkdirSync(CREATIVE_PRESETS_DIR(), { recursive: true });
}

function readJson(file, fallback) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function writeJsonAtomic(file, data) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmp, file);
    try { fs.chmodSync(file, 0o600); } catch {}
}

function deepMerge(base, input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return base;
    const output = { ...base };
    for (const [key, value] of Object.entries(input)) {
        if (value && typeof value === 'object' && !Array.isArray(value) && base?.[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) {
            output[key] = deepMerge(base[key], value);
        } else {
            output[key] = value;
        }
    }
    return output;
}

function normalizeConfig(input, legacyImageSource = input) {
    const defaults = defaultConfig();
    const merged = deepMerge(defaults, input);
    // Vẫn tự phục hồi được khi tệp cũ bị sửa hỏng bằng tay hoặc một mục nào đó là null, tránh việc cả tiện ích chết lúc khởi động chỉ vì gán trường dữ liệu khi di trú.
    for (const section of ['llm','relay','companion','phone','controlAgent','image','embedding','retrieval']) {
        if (!merged[section] || typeof merged[section] !== 'object' || Array.isArray(merged[section])) merged[section] = { ...defaults[section] };
    }
    // U1.7.10 hai API riêng biệt: bể đa nguồn cũ ngừng hẳn; Tiếp sức AI không được dùng lại API tổng kết.
    delete merged.apiPool;
    merged.llm.contextMode = 'scoped';
    merged.llm.fallbackToPreset = false;
    merged.llm.sourcePolicyRevision = 6;
    merged.relay.useMemoryApi = false;
    merged.relay.fallbackToPreset = false;
    merged.relay.sourcePolicyRevision = 4;
    merged.companion.mode = 'independent';
    merged.companion.fallbackToPreset = false;
    merged.companion.sourcePolicyRevision = 4;
    merged.phone.mode = 'realtime-independent';
    merged.phone.fallbackToPreset = false;
    merged.phone.sourcePolicyRevision = 1;
    merged.controlAgent.mode = 'confirmed-actions';
    merged.controlAgent.fallbackToPreset = false;
    merged.controlAgent.sourcePolicyRevision = 1;
    if (!legacyImageSource?.image || !Object.hasOwn(legacyImageSource.image, 'workflowMode')) {
        merged.image.workflowMode = 'strict-character-reference';
        merged.image.identityStrength = 1;
        merged.image.styleFidelity = 0.85;
        merged.image.strength = 0.24;
        merged.image.noise = 0.03;
    }
    merged.image.workflowMode = novelAiPortraitMode(merged.image.workflowMode);
    merged.image.identityStrength = Math.max(0, Math.min(1, Number(merged.image.identityStrength ?? 1)));
    merged.version = VERSION;
    return merged;
}

function loadConfig() {
    ensureDirs();
    const stored = readJson(CONFIG_FILE(), {});
    return normalizeConfig(stored, stored);
}

function saveConfig(input) {
    const current = loadConfig();
    const clean = JSON.parse(JSON.stringify(input || {}));
    delete clean.apiPool;
    for (const section of ['llm','relay','companion','phone','controlAgent','image','embedding']) {
        if (!clean[section]?.extraHeaders || typeof clean[section].extraHeaders !== 'object') continue;
        for (const [key,value] of Object.entries(clean[section].extraHeaders)) {
            if (value === '__REDACTED__' && Object.hasOwn(current[section]?.extraHeaders || {}, key)) clean[section].extraHeaders[key] = current[section].extraHeaders[key];
        }
    }
    const next = normalizeConfig(deepMerge(current, clean), current);
    writeJsonAtomic(CONFIG_FILE(), next);
    return next;
}

function redactConfig(config) {
    const clone = JSON.parse(JSON.stringify(config));
    clone.llm.apiKeyConfigured = Boolean(clone.llm.apiKey);
    clone.relay.apiKeyConfigured = Boolean(clone.relay.apiKey);
    clone.companion.apiKeyConfigured = Boolean(clone.companion.apiKey);
    clone.phone.apiKeyConfigured = Boolean(clone.phone.apiKey);
    clone.controlAgent.apiKeyConfigured = Boolean(clone.controlAgent.apiKey);
    clone.image.apiKeyConfigured = Boolean(clone.image.apiKey);
    clone.embedding.apiKeyConfigured = Boolean(clone.embedding.apiKey);
    clone.llm.apiKey = '';
    clone.relay.apiKey = '';
    clone.companion.apiKey = '';
    clone.phone.apiKey = '';
    clone.controlAgent.apiKey = '';
    clone.image.apiKey = '';
    clone.embedding.apiKey = '';
    const redactHeaders = headers => Object.fromEntries(Object.entries(headers || {}).map(([key,value]) => [key, /authorization|api[-_]?key|token|secret|cookie/i.test(key) ? (String(value||'') ? '__REDACTED__' : '') : value]));
    clone.llm.extraHeaders = redactHeaders(clone.llm.extraHeaders);
    clone.relay.extraHeaders = redactHeaders(clone.relay.extraHeaders);
    clone.companion.extraHeaders = redactHeaders(clone.companion.extraHeaders);
    clone.phone.extraHeaders = redactHeaders(clone.phone.extraHeaders);
    clone.controlAgent.extraHeaders = redactHeaders(clone.controlAgent.extraHeaders);
    clone.embedding.extraHeaders = redactHeaders(clone.embedding.extraHeaders);
    return clone;
}

function getAccountHandle(request) {
    return request?.session?.handle
        || request?.user?.profile?.handle
        || request?.user?.handle
        || request?.locals?.user?.handle
        || null;
}

function requireEnabledAccount(request, response, next) {
    const account = getAccountHandle(request) || DEFAULT_ACCOUNT;
    if (!accountAllowed(account)) {
        return response.status(403).json({ ok: false, enabled: false, account, error: 'account-not-allowed' });
    }
    return accountStorage.run(account, next);
}

// Lúc khởi động chưa biết ai sẽ đăng nhập, nên chỉ hâm nóng những tài khoản đã có
// thư mục dữ liệu từ trước, cộng thêm tài khoản mặc định. Tài khoản mới sẽ được tạo
// thư mục ngay ở lần gọi đầu tiên (ensureDirs).
function bootstrapAccounts() {
    const found = new Set(ACCOUNT_ALLOWLIST.size ? ACCOUNT_ALLOWLIST : [DEFAULT_ACCOUNT]);
    if (!ACCOUNT_ALLOWLIST.size) {
        try {
            for (const entry of fs.readdirSync(DATA_ROOT, { withFileTypes: true })) {
                if (!entry.isDirectory()) continue;
                if (fs.existsSync(path.join(DATA_ROOT, entry.name, 'vvv-theater-memory'))) found.add(entry.name);
            }
        } catch {}
    }
    return [...found];
}

function safeId(value) {
    return String(value ?? '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180) || 'default';
}

function validateCreativePreset(preset) {
    if (!preset || typeof preset !== 'object' || Array.isArray(preset)) throw new Error('preset-object-required');
    if (!Array.isArray(preset.prompts) || !preset.prompts.length) throw new Error('preset-prompts-required');
    if (preset.prompts.length > 3000) throw new Error('preset-prompts-too-many');
    const blocks=Array.isArray(preset.prompt_order) ? preset.prompt_order : Array.isArray(preset.originalPromptOrder) ? preset.originalPromptOrder : [];
    const order=blocks.flatMap(block=>Array.isArray(block?.order)?block.order:[]);
    if (!order.length) throw new Error('preset-prompt-order-required');
    if (order.length > 5000) throw new Error('preset-order-too-many');
    const groups=Array.isArray(preset.extensions?.entryGrouping) ? preset.extensions.entryGrouping : Array.isArray(preset.groups) ? preset.groups : [];
    const regexes=Array.isArray(preset.extensions?.regex_scripts) ? preset.extensions.regex_scripts : Array.isArray(preset.assets?.regex_scripts) ? preset.assets.regex_scripts : [];
    const armorCount=preset.prompts.filter(prompt=>prompt?.identifier==='jailbreak'||/jailbreak|phá giáp|phá giới hạn|chống.*(?:xin lỗi|từ chối)|(?:Gemini|Claude).*bắt buộc bật/i.test(String(prompt?.name||''))).length;
    const clean=preset.extensions?.vvvImportSanitization||preset.vvvImportSanitization||{};
    return {promptCount:preset.prompts.length,orderCount:order.length,enabledCount:order.filter(row=>row?.enabled).length,groupCount:groups.length,regexCount:regexes.length,armorCount,persona:String(clean.persona||''),removedArmorCount:Number(clean.removedArmorCount||0),removedPersonaCount:Number(clean.removedPersonaCount||0),sanitized:clean.schema==='vvv.import-sanitization.v1'};
}
function creativePresetRevision(preset) {
    return crypto.createHash('sha256').update(JSON.stringify(preset || {})).digest('hex').slice(0, 24);
}
function creativePresetFile(id) {
    const clean=safeId(id);
    if(clean!==String(id||''))throw new Error('invalid-preset-id');
    return path.join(CREATIVE_PRESETS_DIR(), `${clean}.json`);
}
function creativePresetMeta(stored) {
    return {id:String(stored.id||''),name:String(stored.name||'Preset chưa đặt tên'),builtin:false,importedAt:Number(stored.importedAt||0),updatedAt:Number(stored.updatedAt||0),revision:String(stored.revision||creativePresetRevision(stored.preset)),...(stored.stats||validateCreativePreset(stored.preset))};
}
function listCreativePresets() {
    ensureDirs();
    return fs.readdirSync(CREATIVE_PRESETS_DIR(),{withFileTypes:true}).filter(entry=>entry.isFile()&&/^preset-[a-f0-9]{20}\.json$/.test(entry.name)).map(entry=>readJson(path.join(CREATIVE_PRESETS_DIR(),entry.name),null)).filter(stored=>stored?.id&&stored?.preset).map(creativePresetMeta).sort((a,b)=>b.importedAt-a.importedAt);
}
function saveCreativePresetHistory(stored, reason = 'update') {
    if (!stored?.id || !stored?.preset) return;
    const dir = CREATIVE_PRESET_HISTORY_DIR(stored.id);
    fs.mkdirSync(dir, { recursive: true });
    const stamp = Date.now();
    const file = path.join(dir, `${stamp}-${crypto.randomBytes(4).toString('hex')}.json`);
    writeJsonAtomic(file, { schema:'vvv.creative.preset-history.v1', id:String(stored.id), createdAt:stamp, reason:String(reason||'update').slice(0,120), name:String(stored.name||''), revision:String(stored.revision||creativePresetRevision(stored.preset)), preset:stored.preset });
    const files = fs.readdirSync(dir, {withFileTypes:true}).filter(entry=>entry.isFile()&&/^\d+-[a-f0-9]{8}\.json$/.test(entry.name)).map(entry=>entry.name).sort().reverse();
    for (const old of files.slice(MAX_CREATIVE_PRESET_HISTORY)) { try { fs.unlinkSync(path.join(dir, old)); } catch {} }
}
function listCreativePresetHistory(id) {
    const dir = CREATIVE_PRESET_HISTORY_DIR(id); if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, {withFileTypes:true}).filter(entry=>entry.isFile()&&/^\d+-[a-f0-9]{8}\.json$/.test(entry.name)).map(entry=>readJson(path.join(dir,entry.name),null)).filter(Boolean).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0)).map(row=>({id:String(row.id||id),createdAt:Number(row.createdAt||0),reason:String(row.reason||''),name:String(row.name||''),revision:String(row.revision||''),bytes:Buffer.byteLength(JSON.stringify(row.preset||{}),'utf8')}));
}

const PHONE_STICKER_MIME = Object.freeze({
    'image/png':'png',
    'image/jpeg':'jpg',
    'image/webp':'webp',
    'image/gif':'gif',
});
function cleanPhoneStickerText(value, max = 120) {
    return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}
function installBuiltinPhoneStickers(data) {
    const manifest=readJson(BUILTIN_STICKERS_MANIFEST,null);
    if(!manifest||!Array.isArray(manifest.stickers))return false;
    const deleted=new Set((data.deletedBuiltinIds||[]).map(safeId));let changed=false;
    const existing=new Map((data.stickers||[]).map(row=>[String(row.id),row]));
    for(const item of manifest.stickers){
        if((data.stickers||[]).length>=MAX_PHONE_STICKERS)break;
        const id=safeId(item?.id),fileName=safeId(item?.fileName);if(!id.startsWith('builtin-emoji-')||deleted.has(id)||!fileName.endsWith('.png'))continue;
        const source=path.join(BUILTIN_STICKERS_DIR,fileName);if(!fs.existsSync(source))continue;
        let row=existing.get(id);
        if(!row){
            const now=Date.now();row={id,fileName,mimeType:'image/png',size:fs.statSync(source).size,name:cleanPhoneStickerText(item.name||'Nhãn dán dựng sẵn',120),category:cleanPhoneStickerText(item.category||'Dựng sẵn',40),tags:(item.tags||[]).map(value=>cleanPhoneStickerText(value,60)).filter(Boolean).slice(0,24),description:cleanPhoneStickerText(item.description,500),builtin:true,builtinCatalogVersion:Number(manifest.catalogVersion||1),createdAt:now,updatedAt:now};
            data.stickers.push(row);existing.set(id,row);changed=true;
        }
    }
    const catalogVersion=Number(manifest.catalogVersion||1);if(Number(data.builtinCatalogVersion||0)!==catalogVersion){data.builtinCatalogVersion=catalogVersion;changed=true;}
    return changed;
}
function loadPhoneStickers() {
    ensureDirs();
    const raw=readJson(PHONE_STICKERS_FILE(), {version:2,stickers:[],builtinCatalogVersion:0,deletedBuiltinIds:[]});
    const stickers=Array.isArray(raw?.stickers)?raw.stickers:[];
    // Ảnh dựng sẵn được phục vụ thẳng từ thư mục tài nguyên chỉ đọc của tiện ích, không còn sao chép 360 tệp ngay lần đầu mở bảng điều khiển.
    // Những dòng dựng sẵn mà bản cũ đã chép vào thư mục dữ liệu chỉ được coi là siêu dữ liệu để di trú; ảnh thực tế luôn lấy theo tài nguyên đi kèm gói cài.
    const custom=stickers.filter(row=>row&&!row.builtin&&PHONE_STICKER_MIME[row.mimeType]&&safeId(row.id)===row.id).slice(-MAX_PHONE_STICKERS);
    const data={version:3,builtinCatalogVersion:Number(raw?.builtinCatalogVersion||0),deletedBuiltinIds:Array.isArray(raw?.deletedBuiltinIds)?raw.deletedBuiltinIds.map(safeId).slice(-MAX_PHONE_STICKERS):[],stickers:custom};
    const catalogChanged=installBuiltinPhoneStickers(data)||Number(raw?.version||0)!==3;
    if(catalogChanged){try{savePhoneStickers(data);}catch(error){console.warn(`[${PLUGIN_ID}] Lưu siêu dữ liệu nhãn dán dựng sẵn khi di trú thất bại, tiếp tục dùng thư mục chỉ đọc đi kèm gói cài:`,error);}}
    return data;
}
function savePhoneStickers(data) {
    writeJsonAtomic(PHONE_STICKERS_FILE(), {version:3,builtinCatalogVersion:Number(data?.builtinCatalogVersion||0),deletedBuiltinIds:(data?.deletedBuiltinIds||[]).map(safeId).slice(-MAX_PHONE_STICKERS),stickers:(data?.stickers||[]).filter(row=>!row?.builtin).slice(-MAX_PHONE_STICKERS)});
}

function phoneStickerFile(row) {
    const base=row?.builtin?BUILTIN_STICKERS_DIR:PHONE_STICKERS_DIR();
    return path.join(base,safeId(row?.fileName));
}
function phoneStickerPublic(row) {
    return {
        id:String(row.id||''),name:String(row.name||''),tags:Array.isArray(row.tags)?row.tags:[],description:String(row.description||''),
        category:String(row.category||''),builtin:Boolean(row.builtin),
        mimeType:String(row.mimeType||''),size:Number(row.size||0),createdAt:Number(row.createdAt||0),updatedAt:Number(row.updatedAt||0),
        imageUrl:`/api/plugins/${PLUGIN_ID}/phone/stickers/${encodeURIComponent(String(row.id||''))}/image`,
    };
}
function decodePhoneStickerData(value, declaredMime = '') {
    const match=String(value||'').match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\r\n]+)$/i);
    if(!match)throw new Error('Định dạng tệp nhãn dán không được hỗ trợ, chỉ chấp nhận PNG, JPG, WebP hoặc GIF');
    const mime=String(match[1]).toLowerCase();
    if(!PHONE_STICKER_MIME[mime]||String(declaredMime||mime).toLowerCase()!==mime)throw new Error('Kiểu tệp nhãn dán không khớp');
    const buffer=Buffer.from(match[2].replace(/\s+/g,''),'base64');
    if(!buffer.length||buffer.length>MAX_PHONE_STICKER_BYTES)throw new Error(`Mỗi nhãn dán phải nhỏ hơn ${Math.floor(MAX_PHONE_STICKER_BYTES/1024/1024)}MB`);
    const valid=mime==='image/png'?buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
        :mime==='image/jpeg'?buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff
        :mime==='image/gif'?['GIF87a','GIF89a'].includes(buffer.subarray(0,6).toString('ascii'))
        :buffer.subarray(0,4).toString('ascii')==='RIFF'&&buffer.subarray(8,12).toString('ascii')==='WEBP';
    if(!valid)throw new Error('Nội dung tệp nhãn dán không khớp với phần mở rộng');
    return {mime,buffer,extension:PHONE_STICKER_MIME[mime]};
}

const PORTRAIT_MIME = Object.freeze({
    'image/png':'png',
    'image/jpeg':'jpg',
    'image/webp':'webp',
});
function cleanPortraitText(value, max = 1200) {
    return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}
function decodePortraitData(value) {
    const match=String(value||'').match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\r\n]+)$/i);
    if(!match)throw new Error('Ảnh tham chiếu chỉ chấp nhận PNG, JPG hoặc WebP');
    const mime=String(match[1]).toLowerCase(),buffer=Buffer.from(match[2].replace(/\s+/g,''),'base64');
    if(!buffer.length||buffer.length>MAX_PORTRAIT_BYTES)throw new Error(`Mỗi ảnh tham chiếu phải nhỏ hơn ${Math.floor(MAX_PORTRAIT_BYTES/1024/1024)}MB`);
    if(!portraitBufferValid(buffer,mime))throw new Error('Nội dung ảnh tham chiếu không khớp với định dạng ảnh');
    return {mime,buffer,extension:PORTRAIT_MIME[mime]};
}
function portraitBufferValid(buffer,mime) {
    if(mime==='image/png')return buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    if(mime==='image/jpeg')return buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff;
    if(mime==='image/webp')return buffer.subarray(0,4).toString('ascii')==='RIFF'&&buffer.subarray(8,12).toString('ascii')==='WEBP';
    return false;
}
function portraitMimeFromBuffer(buffer) {
    for(const mime of Object.keys(PORTRAIT_MIME))if(portraitBufferValid(buffer,mime))return mime;
    return '';
}
function loadPortraitAssets() {
    ensureDirs();
    const raw=readJson(PORTRAIT_ASSETS_FILE(),{version:1,assets:[]});
    const assets=Array.isArray(raw?.assets)?raw.assets:[];
    return {version:1,assets:assets.filter(row=>row&&safeId(row.id)===row.id&&PORTRAIT_MIME[row.mimeType]).slice(-MAX_PORTRAIT_ASSETS)};
}
function savePortraitAssets(data) {
    writeJsonAtomic(PORTRAIT_ASSETS_FILE(),{version:1,assets:(data?.assets||[]).slice(-MAX_PORTRAIT_ASSETS)});
}
function portraitAssetPublic(row) {
    return {
        id:String(row.id||''),kind:String(row.kind||'generated'),subjectId:String(row.subjectId||''),subjectName:String(row.subjectName||''),
        mimeType:String(row.mimeType||''),size:Number(row.size||0),prompt:String(row.prompt||''),negativePrompt:String(row.negativePrompt||''),
        parentId:String(row.parentId||''),floor:Number.isFinite(Number(row.floor))?Number(row.floor):-1,workflow:String(row.workflow||''),fallbackUsed:Boolean(row.fallbackUsed),createdAt:Number(row.createdAt||0),
        imageUrl:`/api/plugins/${PLUGIN_ID}/portrait/assets/${encodeURIComponent(String(row.id||''))}/image`,
    };
}
function portraitAssetFile(row) {
    return path.join(PORTRAIT_ASSETS_DIR(),safeId(row?.fileName||''));
}
function firstImageFromZip(buffer) {
    if(!Buffer.isBuffer(buffer)||buffer.length<22)throw new Error('Gói nén ảnh NovelAI trả về không hợp lệ');
    let eocd=-1;
    for(let index=Math.max(0,buffer.length-65557);index<=buffer.length-22;index+=1){if(buffer.readUInt32LE(index)===0x06054b50)eocd=index;}
    if(eocd<0)throw new Error('Gói nén ảnh NovelAI trả về không hợp lệ');
    const entries=buffer.readUInt16LE(eocd+10),centralOffset=buffer.readUInt32LE(eocd+16);if(centralOffset<0||centralOffset>=eocd)throw new Error('Offset thư mục trong gói nén ảnh NovelAI không hợp lệ');let offset=centralOffset;
    for(let index=0;index<entries&&offset+46<=buffer.length;index+=1){
        if(buffer.readUInt32LE(offset)!==0x02014b50)break;
        const method=buffer.readUInt16LE(offset+10),compressedSize=buffer.readUInt32LE(offset+20),uncompressedSize=buffer.readUInt32LE(offset+24);
        const nameLength=buffer.readUInt16LE(offset+28),extraLength=buffer.readUInt16LE(offset+30),commentLength=buffer.readUInt16LE(offset+32),localOffset=buffer.readUInt32LE(offset+42);
        if(uncompressedSize>MAX_PORTRAIT_BYTES||compressedSize>MAX_PORTRAIT_BYTES)throw new Error('Tệp trong gói nén ảnh NovelAI quá lớn');
        if(offset+46+nameLength+extraLength+commentLength>buffer.length)throw new Error('Thư mục của gói nén ảnh NovelAI đã bị cắt cụt');
        const name=buffer.subarray(offset+46,offset+46+nameLength).toString('utf8');
        if(localOffset+30<=buffer.length&&buffer.readUInt32LE(localOffset)===0x04034b50&&/\.(?:png|jpe?g|webp)$/i.test(name)){
            const localNameLength=buffer.readUInt16LE(localOffset+26),localExtraLength=buffer.readUInt16LE(localOffset+28),start=localOffset+30+localNameLength+localExtraLength;
            if(start<0||start+compressedSize>buffer.length)throw new Error('Dữ liệu nén ảnh NovelAI đã bị cắt cụt');
            const packed=buffer.subarray(start,start+compressedSize);let image;
            if(method===0)image=Buffer.from(packed);else if(method===8)image=zlib.inflateRawSync(packed);else throw new Error(`Thuật toán nén ảnh NovelAI không được hỗ trợ: ${method}`);
            if(uncompressedSize&&image.length!==uncompressedSize)throw new Error('Độ dài ảnh NovelAI sau khi giải nén không khớp');
            const mime=portraitMimeFromBuffer(image);if(mime)return {buffer:image,mime,extension:PORTRAIT_MIME[mime]};
        }
        offset+=46+nameLength+extraLength+commentLength;
    }
    throw new Error('Gói NovelAI trả về không có ảnh dùng được');
}
function unpackNovelAiImage(buffer,contentType='') {
    const directMime=portraitMimeFromBuffer(buffer);if(directMime)return {buffer,mime:directMime,extension:PORTRAIT_MIME[directMime]};
    if(/zip|octet-stream/i.test(contentType)||(buffer.length>=4&&buffer.readUInt32LE(0)===0x04034b50))return firstImageFromZip(buffer);
    throw new Error('NovelAI không trả về dữ liệu ảnh');
}
function novelAiEndpoint(baseUrl='') {
    const clean=String(baseUrl||'https://image.novelai.net').trim().replace(/\/+$/,'');
    return /\/ai\/generate-image$/i.test(clean)?clean:`${clean}/ai/generate-image`;
}
function waitForPortraitRetry(milliseconds) {
    return new Promise(resolve=>setTimeout(resolve,Math.max(0,Number(milliseconds)||0)));
}
function novelAiRetryDelay(response,attempt) {
    const retryAfter=String(response?.headers?.get?.('retry-after')||'').trim(),seconds=Number(retryAfter);
    if(Number.isFinite(seconds)&&seconds>0)return Math.min(30000,Math.max(1000,seconds*1000));
    const date=Date.parse(retryAfter);if(Number.isFinite(date))return Math.min(30000,Math.max(1000,date-Date.now()));
    return NOVELAI_RETRY_DELAYS_MS[Math.min(Math.max(0,Number(attempt)||0),NOVELAI_RETRY_DELAYS_MS.length-1)];
}
function novelAiSeed(value) {
    const parsed=Number(value);
    return Number.isSafeInteger(parsed)&&parsed>=0&&parsed<=0xffffffff?parsed:crypto.randomInt(1,0x7fffffff);
}
function novelAiPortraitMode(value='') {
    const mode=String(value||'').trim().toLowerCase();
    return ['strict-character-reference','flexible-character-reference'].includes(mode)?mode:'strict-character-reference';
}
function buildNovelAiPortraitRequest(config,{prompt,negativePrompt,referenceBuffer}={}) {
    const positive=String(prompt||'').trim().slice(0,16000),negative=String(negativePrompt||config?.negativePrompt||'').trim().slice(0,12000);
    const model=String(config?.model||'nai-diffusion-4-5-curated'),reference=Buffer.isBuffer(referenceBuffer)&&referenceBuffer.length?referenceBuffer:null;
    const seed=novelAiSeed(config?.seed),isV5=/nai-diffusion-5/i.test(model),isV45=/nai-diffusion-4-5/i.test(model),isV4=isV5||/nai-diffusion-4/i.test(model);
    const sampler=String(config?.sampler||'k_euler_ancestral');
    const requestedMode=novelAiPortraitMode(config?.workflowMode);
    if(reference&&!isV45)throw new Error(`Tham chiếu nhận dạng nhân vật bắt buộc dùng mô hình NovelAI 4.5; mô hình hiện tại là ${model}. Đã dừng sinh ảnh, không rơi về chế độ vẽ lại thông thường.`);
    const useCharacterReference=Boolean(reference&&isV45),effectiveMode=!reference?'text2img':requestedMode;
    const parameters={
        params_version:isV5?4:3,width:Math.max(256,Math.min(2048,Number(config?.width||832))),height:Math.max(256,Math.min(2048,Number(config?.height||1216))),
        scale:Math.max(1,Math.min(20,Number(config?.scale||5))),sampler,steps:Math.max(1,Math.min(50,Number(config?.steps||28))),n_samples:1,
        seed,extra_noise_seed:seed,ucPreset:0,qualityToggle:true,negative_prompt:negative,noise_schedule:String(config?.noiseSchedule||'karras'),
        sm:false,sm_dyn:false,dynamic_thresholding:false,controlnet_strength:1,legacy:false,legacy_uc:false,legacy_v3_extend:false,
        add_original_image:true,cfg_rescale:Math.max(0,Math.min(1,Number(config?.cfgRescale||0))),reference_image_multiple:[],
        reference_information_extracted_multiple:[],reference_strength_multiple:[],reference_image_multiple_cached:[],normalize_reference_strength_multiple:false,
    };
    if(isV4){
        parameters.use_coords=false;parameters.characterPrompts=[];
        parameters.v4_prompt={caption:{base_caption:positive,char_captions:[]},use_coords:false,use_order:true};
        parameters.v4_negative_prompt={caption:{base_caption:negative,char_captions:[]},legacy_uc:false};
    }
    if(sampler==='k_euler_ancestral'){parameters.deliberate_euler_ancestral_bug=false;parameters.prefer_brownian=true;}
    if(useCharacterReference){
        const data=reference.toString('base64'),identityStrength=Math.max(0,Math.min(1,Number(config?.identityStrength??1)));
        parameters.director_reference_images_cached=[{cache_secret_key:crypto.randomUUID(),data}];
        parameters.director_reference_descriptions=[{caption:{base_caption:effectiveMode==='strict-character-reference'?'character&style':'character',char_captions:[]},legacy_uc:false}];
        parameters.director_reference_information_extracted=[1];
        parameters.director_reference_strength_values=[identityStrength];
        parameters.director_reference_secondary_strength_values=[Math.max(0,1-identityStrength)];
    }
    if(isV5){
        parameters.straight_alpha=false;parameters.tag_hint_qt=1;parameters.tag_hint_uc_preset=0;parameters.ucPresetId='none';parameters.qualityPresetId='standard';parameters.image_format='png';
        delete parameters.ucPreset;delete parameters.qualityToggle;
    }
    return {model,action:'generate',workflow:effectiveMode,requestedWorkflow:requestedMode,usesCharacterReference:useCharacterReference,body:{input:positive,model,action:'generate',parameters}};
}
function novelAiHttpError(status,detail,totalAttempts) {
    const suffix=detail?`: ${String(detail).slice(0,1200)}`:'';
    if(status===400)return `NovelAI 400 tham số yêu cầu không qua được kiểm tra${suffix}`;
    if(status===401)return 'NovelAI 401: API Token không hợp lệ hoặc đã hết hạn';
    if(status===402)return 'NovelAI 402: gói thuê bao hoặc hạn mức Anlas của tài khoản không đủ';
    if(status===429)return `Tài khoản NovelAI này vẫn còn tác vụ ảnh đang chiếm chỗ (đã thử ${totalAttempts} lần). Hãy đợi tác vụ hiện tại xong rồi thử lại, và đừng đồng thời sinh ảnh trên trang NovelAI hay tiện ích khác.`;
    if([500,502,503,504].includes(status))return `NovelAI ${status} dịch vụ đang trục trặc tạm thời (đã thử ${totalAttempts} lần)${suffix}. Hãy thử lại sau, hoặc kiểm tra địa chỉ proxy ngược.`;
    return `NovelAI ${status}${suffix}`;
}
function novelAiNetworkError(error,totalAttempts) {
    const cause=error?.cause||{},code=String(cause.code||error?.code||'').trim(),detail=String(cause.message||error?.message||error||'Yêu cầu mạng thất bại').trim();
    const hint=/ENOTFOUND|EAI_AGAIN/i.test(code)?'Máy chủ không phân giải được tên miền, hãy kiểm tra DNS hoặc Base URL'
        :/ECONNREFUSED/i.test(code)?'Địa chỉ đích từ chối kết nối, hãy kiểm tra cổng proxy ngược và trạng thái dịch vụ'
        :/CERT|TLS|SSL/i.test(`${code} ${detail}`)?'Xác thực chứng chỉ TLS thất bại, hãy kiểm tra chuỗi chứng chỉ của proxy ngược'
        :/TIMEOUT|UND_ERR_CONNECT_TIMEOUT/i.test(`${code} ${detail}`)?'Kết nối quá hạn, hãy kiểm tra đường mạng từ máy chủ tới NovelAI'
        :'Hãy kiểm tra mạng của máy chủ, proxy và NovelAI Base URL';
    return `Kết nối mạng tới NovelAI thất bại (đã thử ${totalAttempts} lần${code?`, ${code}`:''}): ${detail}. ${hint}.`;
}
function queuePortraitGeneration(task) {
    const account=activeAccount(),tail=portraitGenerationQueues.get(account)||Promise.resolve();
    const next=tail.catch(()=>{}).then(()=>accountStorage.run(account,task));
    let tracked;tracked=next.catch(()=>{}).finally(()=>{if(portraitGenerationQueues.get(account)===tracked)portraitGenerationQueues.delete(account);});
    portraitGenerationQueues.set(account,tracked);return next;
}
async function generateNovelAiPortrait(config,{prompt,negativePrompt,referenceBuffer}={}) {
    if(!config?.enabled)throw new Error('Tính năng NovelAI vẽ theo cốt truyện chưa được bật');
    if(!String(config.apiKey||'').trim())throw new Error('Chưa lưu NovelAI API Token');
    if(!String(prompt||'').trim())throw new Error('Câu lệnh sinh ảnh đang trống');
    const request=buildNovelAiPortraitRequest(config,{prompt,negativePrompt,referenceBuffer});
    const totalAttempts=NOVELAI_RETRY_DELAYS_MS.length+1;
    const requestBody=JSON.stringify(request.body);
    for(let attempt=0;attempt<=NOVELAI_RETRY_DELAYS_MS.length;attempt+=1){
        const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.max(20,Math.min(900,Number(config.timeoutSeconds||180)))*1000);
        try{
            const response=await fetch(novelAiEndpoint(config.baseUrl),{method:'POST',headers:{Authorization:`Bearer ${config.apiKey}`,'Content-Type':'application/json',Accept:'application/zip, image/png'},body:requestBody,signal:controller.signal});
            const bytes=Buffer.from(await response.arrayBuffer());
            if(response.ok){try{return {...unpackNovelAiImage(bytes,response.headers.get('content-type')||''),workflow:request.workflow,requestedWorkflow:request.requestedWorkflow,fallbackUsed:false};}catch(error){error.novelAiResponse=true;throw error;}}
            const detail=bytes.toString('utf8').slice(0,4000);
            if(NOVELAI_TRANSIENT_STATUS.has(response.status)&&attempt<NOVELAI_RETRY_DELAYS_MS.length){await waitForPortraitRetry(novelAiRetryDelay(response,attempt));continue;}
            let message=novelAiHttpError(response.status,detail||response.statusText,totalAttempts);
            if(response.status===400&&request.usesCharacterReference)message+= '. Character Reference không thành công, đã dừng sinh ảnh; tiện ích không rơi về img2img thường và cũng không lưu kết quả ghép mặt.';
            const failure=new Error(message);failure.novelAiHttp=true;throw failure;
        }catch(error){
            if(error?.name==='AbortError')throw new Error('Sinh ảnh NovelAI quá hạn');
            if(error?.novelAiHttp||error?.novelAiResponse)throw error;
            if(attempt<NOVELAI_RETRY_DELAYS_MS.length){await waitForPortraitRetry(NOVELAI_RETRY_DELAYS_MS[attempt]);continue;}
            throw new Error(novelAiNetworkError(error,totalAttempts));
        }finally{clearTimeout(timer);}
    }
    throw new Error('Sinh ảnh NovelAI chưa hoàn tất');
}


function stableHashId(prefix, value) {
    return `${prefix}-${crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 24)}`;
}

function cardCharacterDir(characterKey) {
    return path.join(CARD_ARCHIVE_DIR(), stableHashId('character', characterKey));
}
function cardArchiveDir(characterKey, archiveId) {
    return path.join(cardCharacterDir(characterKey), safeId(archiveId));
}
function cardArchiveStateFile(characterKey, archiveId) { return path.join(cardArchiveDir(characterKey, archiveId), 'state.json'); }
function cardArchiveManifestFile(characterKey, archiveId) { return path.join(cardArchiveDir(characterKey, archiveId), 'manifest.json'); }
function cardArchiveHistoryDir(characterKey, archiveId) { return path.join(cardArchiveDir(characterKey, archiveId), 'history'); }
function cardArchiveUploadDir(uploadId) { return path.join(CARD_ARCHIVE_UPLOAD_DIR(), safeId(uploadId)); }

function loadCardArchiveBindings() {
    const raw=readJson(CARD_ARCHIVE_BINDINGS_FILE(), {version:1,bindings:{}});
    if(!raw||typeof raw!=='object')return {version:1,bindings:{}};
    if(!raw.bindings||typeof raw.bindings!=='object'||Array.isArray(raw.bindings))raw.bindings={};
    return raw;
}
function saveCardArchiveBindings(data) { writeJsonAtomic(CARD_ARCHIVE_BINDINGS_FILE(), data); }

function pruneCardArchiveHistory(characterKey, archiveId) {
    // Kho tư liệu vĩnh viễn S10: ảnh chụp lịch sử là một phần tư liệu của người dùng; nâng cấp/lưu/tác vụ định kỳ đều không có quyền tự xóa.
    return { preserved:true, characterKey, archiveId };
}

function readCardArchive(characterKey, archiveId) {
    const manifest=readJson(cardArchiveManifestFile(characterKey,archiveId),null);
    const state=readJson(cardArchiveStateFile(characterKey,archiveId),null);
    if(!manifest)return null;
    return {manifest,state};
}


function hubCompact(value, max=900) {
    const text=String(value??'').replace(/\s+/g,' ').trim();
    return text.length>max?`${text.slice(0,Math.max(0,max-1))}…`:text;
}
function hubFloor(value) {
    const n=Number(value);
    return Number.isFinite(n)&&n>=0?n:null;
}
function hubArchiveRows() {
    const rows=[];
    const root=CARD_ARCHIVE_DIR();
    try {
        for (const charDir of fs.readdirSync(root,{withFileTypes:true})) {
            if(!charDir.isDirectory()||!charDir.name.startsWith('character-'))continue;
            const base=path.join(root,charDir.name);
            for(const archiveDir of fs.readdirSync(base,{withFileTypes:true})){
                if(!archiveDir.isDirectory())continue;
                const manifest=readJson(path.join(base,archiveDir.name,'manifest.json'),null);
                if(!manifest?.characterKey)continue;
                rows.push({
                    characterKey:String(manifest.characterKey),archiveId:String(manifest.archiveId||archiveDir.name),
                    characterName:String(manifest.characterName||'Nhân vật chưa đặt tên'),avatar:String(manifest.avatar||''),
                    chatKey:String(manifest.chatKey||''),chatName:String(manifest.chatName||'Cuộc trò chuyện chưa đặt tên'),
                    createdAt:Number(manifest.createdAt||0),updatedAt:Number(manifest.updatedAt||0),saveCount:Number(manifest.saveCount||0),
                    metrics:manifest.metrics||{},lastReason:String(manifest.lastReason||''),
                });
            }
        }
    } catch {}
    return rows.sort((a,b)=>b.updatedAt-a.updatedAt);
}
function hubPhoneOrders(state) {
    const commerce=state?.phone?.commerce||{};
    const rows=[];
    for(const [platform,data] of Object.entries(commerce)){
        for(const order of Array.isArray(data?.orders)?data.orders:[]){
            rows.push({...order,platform:order?.platform||platform});
        }
    }
    return rows.sort((a,b)=>Number(b?.createdAt||b?.updatedAt||b?.sourceFloor||0)-Number(a?.createdAt||a?.updatedAt||a?.sourceFloor||0));
}
function hubStateView(state={}) {
    const tables=state?.tables||{};
    return {
        scene:state?.scene||{},
        mainline:Array.isArray(tables.mainline)?tables.mainline:[],
        promises:Array.isArray(tables.promises)?tables.promises:[],
        people:Array.isArray(tables.people)?tables.people:[],
        relations:Array.isArray(tables.relations)?tables.relations:[],
        summaries:Array.isArray(tables.summaries)?tables.summaries:[],
        anchors:Array.isArray(state?.memoryAnchors)?state.memoryAnchors:[],
        episodeFacts:Array.isArray(state?.episodeFacts)?state.episodeFacts:[],
        lifeFacts:Array.isArray(state?.lifeFacts)?state.lifeFacts:[],
        appearances:Array.isArray(state?.appearances)?state.appearances:[],
        secrets:Array.isArray(state?.secrets)?state.secrets:[],
        chapters:Array.isArray(state?.chapters)?state.chapters:[],
        orders:hubPhoneOrders(state),
        updatedAt:Number(state?.updatedAt||0),
    };
}
function hubSearchDocuments(view={}) {
    const docs=[];
    const push=(type,title,text,floor=null,storyTime='',extra={})=>{
        const body=hubCompact(text,720);if(!body)return;
        docs.push({type,title:hubCompact(title,240),text:body,floor:hubFloor(floor),storyTime:hubCompact(storyTime,120),...extra});
    };
    for(const row of view.mainline||[])push('timeline',row['Tóm tắt sự kiện']||'Dòng thời gian',row['Tóm tắt sự kiện'],row['Tầng']??row._sourceFloor,[row['Ngày'],row['Giờ bắt đầu']].filter(Boolean).join(' '),{status:row['Trạng thái']||'',deletePath:'tables.mainline',deleteItem:row});
    for(const row of view.promises||[])push('promise',row['Nội dung lời hẹn']||'Lời hẹn',`${row['Nội dung lời hẹn']||''} ${row['Nhân vật cốt lõi']||''} ${row['Trạng thái']||''}`,row['Tầng']??row._sourceFloor,row._recordedStoryTime||row['Thời điểm hẹn']||'',{status:row['Trạng thái']||'',deletePath:'tables.promises',deleteItem:row});
    for(const row of view.people||[])push('person',row['Họ tên']||'Nhân vật',Object.values(row).filter(v=>typeof v==='string'||typeof v==='number').join(' '),row['Tầng']??row._sourceFloor,'',{deletePath:'tables.people',deleteItem:row});
    for(const row of view.relations||[])push('relation',`${row['Nhân vật A']||'?'} ↔ ${row['Nhân vật B']||'?'}`,Object.values(row).filter(v=>typeof v==='string'||typeof v==='number').join(' '),row._sourceFloor,row['Thời điểm cập nhật']||'',{deletePath:'tables.relations',deleteItem:row});
    for(const row of view.anchors||[])push('anchor',row.event||'Sự kiện cốt lõi',`${row.event||''} ${row.details||''} ${(row.tags||[]).join(' ')}`,row.floor,[row.date,row.time].filter(Boolean).join(' '),{importance:row.importance||'',deletePath:'memoryAnchors',deleteItem:row});
    for(const row of view.episodeFacts||[])push('episode',row.fact||'Sự kiện nguyên tử',`${row.fact||''} ${(row.people||[]).join(' ')}`,row.floor,row.time||'',{deletePath:'episodeFacts',deleteItem:row});
    for(const row of view.lifeFacts||[])push('life',`${row.subject||''} ${row.key||row.category||''}`,`${row.value||''} ${row.fact||''} ${row.evidence||''}`,row.floor,row.time||'',{deletePath:'lifeFacts',deleteItem:row});
    for(const row of view.orders||[]){const platform=String(row.platform||'');push('order',row.storeName||row.merchant||'Đơn hàng điện thoại',`${row.storeName||row.merchant||''} ${JSON.stringify(row.items||[])} ${row.status||''}`,row.sourceFloor,row.storyTime||row.time||'',{platform,status:row.status||'',deletePath:platform?`phone.commerce.${platform}.orders`:'',deleteItem:row});}
    return docs;
}
function hubKeywordSearch(view,q,limit=50) {
    const terms=String(q||'').toLowerCase().split(/[\s,;.]+/).map(x=>x.trim()).filter(Boolean).slice(0,12);
    const docs=hubSearchDocuments(view);
    if(!terms.length)return docs.slice(-Math.max(1,Math.min(200,limit))).reverse();
    return docs.map(doc=>{
        const hay=`${doc.title} ${doc.text} ${doc.storyTime} ${doc.status||''}`.toLowerCase();
        let score=0;for(const term of terms){if(hay.includes(term))score+=term.length>=4?3:2;}
        if(terms.every(term=>hay.includes(term)))score+=4;
        return {...doc,score};
    }).filter(row=>row.score>0).sort((a,b)=>b.score-a.score||Number(b.floor??-1)-Number(a.floor??-1)).slice(0,Math.max(1,Math.min(200,Number(limit)||50)));
}

const HUB_DELETE_PATHS = [
    /^tables\.(mainline|promises|people|relations|summaries|items|states|branches)$/,
    /^(memoryAnchors|episodeFacts|lifeFacts|appearances|secrets|chapters)$/,
    /^phone\.commerce\.(taobao|eleme|jd|meituan)\.orders$/,
];
function hubDeletePathAllowed(pathKey='') { return HUB_DELETE_PATHS.some(re=>re.test(String(pathKey||''))); }
function hubDeleteItemKey(pathKey,item) { return archiveArrayItemKey(item,pathKey); }
function hubArchiveIdentity(manifest={}) {
    return {characterId:manifest.characterId||'',characterName:manifest.characterName||'',avatar:manifest.avatar||'',chatKey:manifest.chatKey||'',chatName:manifest.chatName||'',chatAnchor:manifest.chatAnchor||''};
}
function hubDeleteMemoryItem({characterKey,archiveId,pathKey,itemKey}={}) {
    if(!characterKey||!archiveId)throw new Error('characterKey-and-archiveId-required');
    if(!hubDeletePathAllowed(pathKey))throw new Error('memory-path-not-deletable');
    const archive=readCardArchive(characterKey,archiveId);if(!archive?.state)throw new Error('archive-not-found');
    const current=getArchivePath(archive.state,pathKey);if(!Array.isArray(current))throw new Error('memory-path-not-array');
    const target=current.find(item=>hubDeleteItemKey(pathKey,item)===String(itemKey||''));if(!target)throw new Error('memory-item-not-found');
    const next=jsonClone(archive.state);
    const rows=getArchivePath(next,pathKey)||[];
    setArchivePath(next,pathKey,rows.filter(item=>hubDeleteItemKey(pathKey,item)!==String(itemKey||'')));
    next.manualDeletionTombstones=Array.isArray(next.manualDeletionTombstones)?next.manualDeletionTombstones:[];
    next.manualDeletionTombstones.push({id:`hub-delete-${Date.now()}-${crypto.randomUUID()}`,reason:'user-explicit-delete',path:pathKey,items:[jsonClone(target)],deletedAt:Date.now(),source:'VVV Memory Hub'});
    next.manualDeletionTombstones=next.manualDeletionTombstones.slice(-1200);
    const manifest=writeCardArchiveState({characterKey,archiveId,state:next,reason:'hub-user-explicit-delete',identity:hubArchiveIdentity(archive.manifest||{})});
    return {manifest,deleted:{path:pathKey,key:String(itemKey||''),title:hubCompact(target?.['Tóm tắt sự kiện']||target?.['Nội dung lời hẹn']||target?.['Họ tên']||target?.event||target?.fact||target?.storeName||target?.merchant||'',160)}};
}
function hubTrashArchive({characterKey,archiveId}={}) {
    if(!characterKey||!archiveId)throw new Error('characterKey-and-archiveId-required');
    const archive=readCardArchive(characterKey,archiveId);if(!archive)throw new Error('archive-not-found');
    const dir=cardArchiveDir(characterKey,archiveId);if(!fs.existsSync(dir))throw new Error('archive-directory-not-found');
    const trashRoot=path.join(CARD_ARCHIVE_DIR(),'hub-trash');fs.mkdirSync(trashRoot,{recursive:true});
    const target=path.join(trashRoot,`${Date.now()}-${safeId(archiveId)}`);fs.renameSync(dir,target);
    const bindings=loadCardArchiveBindings();let changed=false;
    for(const [chatKey,binding] of Object.entries(bindings.bindings||{})){
        if(String(binding?.archiveId||'')===String(archiveId)&&String(binding?.characterKey||'')===String(characterKey)){delete bindings.bindings[chatKey];changed=true;}
    }
    if(changed)saveCardArchiveBindings(bindings);
    return {trashed:true,trashId:path.basename(target),characterName:archive.manifest?.characterName||'',chatName:archive.manifest?.chatName||''};
}

function jsonClone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function archivePathIsReplaceableArray(pathKey) {
    // S10: mặc định “mảng chưa biết cũng luôn nối thêm vĩnh viễn”, để mô-đun thêm mới sau này không mất lịch sử chỉ vì quên đưa vào danh sách trắng.
    // Chỉ những mảng rõ ràng thuộc hàng đợi công việc / lựa chọn UI / giỏ hàng biến động mới được phép thay thế toàn bộ khi lưu thông thường.
    return [
        /^progress\.assistantMemoryQueue$/,
        /^hiddenSummaryIds$/,
        /^summaryJobs$/,
        /^summaryRecycleBin$/,
        /^manualDeletionTombstones$/,
        /^phone\.manualDeletionTombstones$/,
        /^phone\.pendingOutgoing$/,
        /^phone\.commerce\.(taobao|eleme|jd|meituan)\.cart$/,
        /^phone\.themeStore\.installed$/,
        /\.likes$/,
        /^takeover\./,
    ].some(re=>re.test(pathKey));
}

function archivePathIsPermanentHistory(pathKey) {
    return !archivePathIsReplaceableArray(pathKey);
}

function archiveArrayItemKey(item, pathKey) {
    if (item === null || item === undefined) return `primitive:${String(item)}`;
    if (typeof item !== 'object') return `primitive:${String(item)}`;
    const semantic=value=>String(value??'').toLowerCase().replace(/[\s:,.;!?"'“”‘’()\[\]【】_-]+/g,'').slice(0,500);
    if (/^tables\.people$/.test(pathKey) && item['Họ tên']) return `person:${semantic(item['Họ tên'])}`;
    if (/^tables\.relations$/.test(pathKey)) {
        const a=semantic(item['Nhân vật A']||''),b=semantic(item['Nhân vật B']||'');
        if(a||b)return `relation:${[a,b].sort().join('|')}`;
    }
    if (/^tables\.summaries$/.test(pathKey)) return `summary:${semantic(item['Loại']||item['Loại bảng']||'')}|${semantic(item['Tầng bao phủ']||'')}`;
    if (/^tables\.items$/.test(pathKey)) return `item:${item._entityId||item.itemId||semantic(item['Tên vật phẩm']||item['Tên đồ vật']||item.name||'')}`;
    if (/^tables\.promises$/.test(pathKey)) return `promise:${item._entityId||item.promiseId||`${semantic(item['Nhân vật cốt lõi']||item.characters||'')}|${semantic(item['Nội dung lời hẹn']||item.content||'')}`}`;
    if (/^episodeFacts$/.test(pathKey)) return `episode:${item.id||`${item.sourceMessageKey||''}|${item.floor??''}|${semantic(item.fact||'')}`}`;
    if (/^secrets$/.test(pathKey)) return `secret:${item._entityId||item.secretId||`${semantic(item.subject||'')}|${semantic(item.content||'')}`}`;
    if (/^appearances$/.test(pathKey)) return `appearance:${semantic(item.character||'')}`;
    if (/^phone\.groupProfiles$/.test(pathKey)) return `group-profile:${item.groupName||''}|${item.homeWorldKey||''}`;
    if (/^phone\.contactProfiles$/.test(pathKey)) return `contact-profile:${item.name||''}|${item.homeWorldKey||''}`;
    if (/^phone\.threads$/.test(pathKey)) return `thread:${item.contact||''}`;
    if (/^phone\.groupThreads$/.test(pathKey)) return `group-thread:${item.groupName||''}|${item.homeWorldKey||''}`;
    if (/^characterWorld\.characters$/.test(pathKey)) return `world-character:${item.name||''}`;
    if (/^phone\.(wechat|wechatGroups|channelGroups|sms|calls)$/.test(pathKey)) {
        return `phone-event:${item.groupName||''}|${item.sender||item.author||item.contact||''}|${item.time||''}|${item.content||item.status||''}|${JSON.stringify(item.attachments||[])}`;
    }
    for (const key of ['_archiveItemId','id','_id','pendingId','archiveId']) if (item[key]) return `${key}:${String(item[key])}`;
    return `json:${JSON.stringify(item)}`;
}

function archiveArrayLegacySignature(item) {
    if (item === null || item === undefined) return `primitive:${String(item)}`;
    if (typeof item !== 'object') return `primitive:${String(item)}`;
    if (Array.isArray(item)) return `array:${JSON.stringify(item)}`;
    const copy=jsonClone(item);
    delete copy._archiveItemId;
    return `legacy:${JSON.stringify(copy)}`;
}

function mergePermanentArray(previous, incoming, pathKey) {
    const out=[];
    const positions=new Map();
    const legacyPositions=new Map();
    const register=(item,index)=>{
        positions.set(archiveArrayItemKey(item,pathKey),index);
        legacyPositions.set(archiveArrayLegacySignature(item),index);
    };
    const append=(item, fromIncoming=false)=>{
        const key=archiveArrayItemKey(item,pathKey);
        let index=positions.get(key);
        // Lần đầu nâng lên S10, đối tượng hồ sơ cũ có thể chưa có _archiveItemId; nếu nội dung trùng khớp hoàn toàn thì nâng thẳng mục cũ lên ID ổn định mới thay vì tạo thêm bản sao.
        if(index===undefined && fromIncoming && item && typeof item==='object' && item._archiveItemId){
            index=legacyPositions.get(archiveArrayLegacySignature(item));
        }
        if(index===undefined){
            index=out.length;
            out.push(jsonClone(item));
            register(out[index],index);
            return;
        }
        if(fromIncoming && item && typeof item==='object' && !Array.isArray(item)){
            const prior=out[index],next=mergePermanentArchiveValue(prior,item,`${pathKey}[]`);
            if(pathKey==='tables.relations'){
                const decision=serverRelationUpdateDecision(prior?.['Mô tả quan hệ'],item?.['Mô tả quan hệ'],item?._evidenceText||'');
                if(!decision.accept&&prior?.['Mô tả quan hệ'])next['Mô tả quan hệ']=prior['Mô tả quan hệ'];
            }
            out[index]=next;
            register(out[index],index);
        }
    };
    for(const item of Array.isArray(previous)?previous:[])append(item,false);
    for(const item of Array.isArray(incoming)?incoming:[])append(item,true);
    return out;
}

function serverRelationUpdateDecision(oldDescription='',newDescription='',sourceText='') {
    const oldValue=String(oldDescription||'').trim(),nextValue=String(newDescription||'').trim(),evidence=String(sourceText||'');
    if(!nextValue||nextValue===oldValue)return {accept:Boolean(nextValue),reason:nextValue?'same-value':'empty-update'};
    const stable=/(?:đồng nghiệp|người yêu cũ|bạn trai cũ|bạn gái cũ|người yêu|bạn trai|bạn gái|vợ chồng|vợ|chồng|bạn đời|bố mẹ|mẹ|bố|má|ba|anh em|chị em|người nhà|họ hàng|bạn bè|bạn học|bạn cùng phòng|cấp trên|cấp dưới|đối tác|thầy trò|chủ thuê|người làm thuê)/.test(oldValue);
    const unfamiliar=/(?:xa lạ|không quen|chưa từng quen biết|lần đầu gặp|gặp lần đầu|chưa từng gặp|không thân|chẳng có quan hệ gì|không có quan hệ|người qua đường)/.test(nextValue);
    const resetEvidence=/(?:mất trí nhớ|mất ký ức|bị tẩy não|nhận thức bị sửa đổi|giả vờ không quen|vờ như không quen|giả làm người lạ|cắt đứt quan hệ|thân phận bị tráo|mạo danh|xác nhận nhận nhầm người)/.test(evidence);
    if(stable&&unfamiliar&&!resetEvidence)return {accept:false,reason:'stable-relation-downgrade-without-reset-evidence'};
    const generic=value=>/^(?:đang tương tác trong mạch truyện hiện tại|đang tương tác lúc này|đang tương tác|đã quen biết|tiếp xúc lần đầu|tương tác hiện tại)$/.test(value);
    if(generic(nextValue)&&oldValue&&!generic(oldValue))return {accept:false,reason:'specific-relation-downgraded-to-generic'};
    return {accept:true,reason:'supported-update'};
}

function mergePermanentArchiveValue(previous, incoming, pathKey='') {
    if (incoming === undefined) return jsonClone(previous);
    if (previous === undefined || previous === null) return jsonClone(incoming);
    if (Array.isArray(incoming)) {
        if (!Array.isArray(previous)) return jsonClone(incoming);
        return archivePathIsPermanentHistory(pathKey)
            ? mergePermanentArray(previous,incoming,pathKey)
            : jsonClone(incoming);
    }
    if (incoming && typeof incoming==='object') {
        if (!previous || typeof previous!=='object' || Array.isArray(previous)) return jsonClone(incoming);
        const out={...jsonClone(previous)};
        for(const [key,value] of Object.entries(incoming)){
            const child=pathKey?`${pathKey}.${key}`:key;
            out[key]=mergePermanentArchiveValue(previous[key],value,child);
        }
        return out;
    }
    return incoming;
}

function summaryDeletionSignature(row) {
    return [row?.['Loại']||row?.['Loại bảng']||'',row?.['Tầng bao phủ']||'',row?.['Nội dung tổng kết']||''].map(v=>String(v||'')).join('|');
}

function getArchivePath(root, pathKey) {
    const parts=String(pathKey||'').split('.').filter(Boolean);
    let current=root;
    for(const part of parts){
        if(!current || typeof current!=='object')return undefined;
        current=current[part];
    }
    return current;
}

function setArchivePath(root, pathKey, value) {
    const parts=String(pathKey||'').split('.').filter(Boolean);
    if(!parts.length)return false;
    let current=root;
    for(let i=0;i<parts.length-1;i++){
        const part=parts[i];
        if(!current[part] || typeof current[part]!=='object' || Array.isArray(current[part]))current[part]={};
        current=current[part];
    }
    current[parts.at(-1)]=value;
    return true;
}

function applyArchiveUserDeletionTombstones(merged, incoming) {
    // 1) Giao thức thùng rác tổng kết cũ: bản tổng kết bị người dùng xóa tường minh được phép biến mất khỏi “giao diện hiện tại”; ảnh chụp lịch sử vẫn tồn tại vĩnh viễn.
    const summaryTombstones=(incoming?.summaryRecycleBin||[]).filter(row=>row?._deletedReason==='manual-delete');
    const deletedSummaryIds=new Set(summaryTombstones.map(row=>String(row?._id||row?.id||'')).filter(Boolean));
    const deletedSummarySignatures=new Set(summaryTombstones.map(summaryDeletionSignature).filter(Boolean));
    if((deletedSummaryIds.size||deletedSummarySignatures.size) && Array.isArray(merged?.tables?.summaries)){
        merged.tables.summaries=merged.tables.summaries.filter(row=>{
            const id=String(row?._id||row?.id||'');
            if(id&&deletedSummaryIds.has(id))return false;
            return !deletedSummarySignatures.has(summaryDeletionSignature(row));
        });
    }

    // 2) Bia mộ xóa dùng chung của S10: chỉ khi người dùng bấm “xóa/dọn sạch” trên giao diện mới sinh ra reason=user-explicit-delete.
    // Lưu thông thường, nâng cấp tiện ích, xóa/sinh lại chính văn, khôi phục điện thoại và nhập từ CardVault đều không sinh bia mộ, nên không có quyền rút ngắn mảng vĩnh viễn.
    const generic=[
        ...(Array.isArray(incoming?.manualDeletionTombstones)?incoming.manualDeletionTombstones:[]),
        ...(Array.isArray(incoming?.phone?.manualDeletionTombstones)?incoming.phone.manualDeletionTombstones:[]),
    ].filter(row=>row?.reason==='user-explicit-delete' && row?.path && Array.isArray(row?.items) && row.items.length);
    for(const tombstone of generic){
        const pathKey=String(tombstone.path||'');
        const current=getArchivePath(merged,pathKey);
        if(!Array.isArray(current))continue;
        const keys=new Set(tombstone.items.map(item=>archiveArrayItemKey(item,pathKey)));
        const legacy=new Set(tombstone.items.map(archiveArrayLegacySignature));
        setArchivePath(merged,pathKey,current.filter(item=>{
            if(keys.has(archiveArrayItemKey(item,pathKey)))return false;
            return !legacy.has(archiveArrayLegacySignature(item));
        }));
    }
    return merged;
}

function mergePermanentArchiveState(previousState, incomingState, reason='normal') {
    if(!previousState || typeof previousState!=='object')return jsonClone(incomingState);
    // Khôi phục/nhập/lấy lại từ thùng rác một cách tường minh là thao tác thay thế trọn gói có thẩm quyền; nếu không, dữ liệu cũ sẽ bị nối lại và “sống dậy”.
    const reasonText=String(reason||'');
    if(/wipe-reset|restore-safety|import-backup|user-recycle-restore|summary-recreate-from-recycle/i.test(reasonText))return jsonClone(incomingState);
    const merged=mergePermanentArchiveValue(previousState,incomingState,'');
    return applyArchiveUserDeletionTombstones(merged,incomingState);
}

function writeCardArchiveState({characterKey,archiveId,state,reason='normal',identity={}}={}) {
    if(!characterKey||!archiveId)throw new Error('archive-binding-required');
    if(!state||typeof state!=='object'||Array.isArray(state))throw new Error('invalid-archive-state');
    const dir=cardArchiveDir(characterKey,archiveId);fs.mkdirSync(dir,{recursive:true});
    const manifestFile=cardArchiveManifestFile(characterKey,archiveId),stateFile=cardArchiveStateFile(characterKey,archiveId);
    const previousManifest=readJson(manifestFile,{})||{};
    const previousState=readJson(stateFile,null);
    const safeState=mergePermanentArchiveState(previousState,state,reason);
    const stateBytes=Buffer.byteLength(JSON.stringify(safeState),'utf8');
    if(stateBytes>MAX_STATE_BYTES)throw new Error(`state-too-large>${MAX_STATE_BYTES}`);
    const now=Date.now();
    const significant=/wipe|delete|restore|import|manual|reset|rebuild|initial-bind/i.test(String(reason||''));
    const lastHistory=Number(previousManifest.lastHistoryAt||0);
    const stateChanged=previousState?JSON.stringify(previousState)!==JSON.stringify(safeState):true;
    if(previousState && stateChanged && (significant || now-lastHistory>5*60*1000)){
        const hdir=cardArchiveHistoryDir(characterKey,archiveId);fs.mkdirSync(hdir,{recursive:true});
        writeJsonAtomic(path.join(hdir,`${now}.json`),{createdAt:now,reason:String(reason||'auto').slice(0,120),state:previousState});
        previousManifest.lastHistoryAt=now;pruneCardArchiveHistory(characterKey,archiveId);
    }
    const manifest={
        schema:'vvv-theater-card-archive-v1',archiveId:String(archiveId),characterKey:String(characterKey),
        characterId:String(identity?.characterId||previousManifest.characterId||''),characterName:String(identity?.characterName||previousManifest.characterName||''),avatar:String(identity?.avatar||previousManifest.avatar||''),
        chatKey:String(identity?.chatKey||previousManifest.chatKey||''),chatName:String(identity?.chatName||previousManifest.chatName||''),chatAnchor:String(identity?.chatAnchor||previousManifest.chatAnchor||''),
        createdAt:Number(previousManifest.createdAt||now),updatedAt:now,boundAt:Number(previousManifest.boundAt||now),saveCount:Number(previousManifest.saveCount||0)+1,
        lastReason:String(reason||'normal').slice(0,120),lastHistoryAt:Number(previousManifest.lastHistoryAt||0),metrics:snapshotMetrics(safeState),
    };
    writeJsonAtomic(stateFile,safeState);writeJsonAtomic(manifestFile,manifest);
    return manifest;
}

function findPendingCardVaultArchive({characterKey,chatKey,chatName='',chatAnchor='',bindings}={}) {
    const dir=cardCharacterDir(characterKey);
    const alreadyBound=new Set(Object.values(bindings?.bindings||{}).filter(row=>String(row?.characterKey||'')===String(characterKey)).map(row=>String(row?.archiveId||'')).filter(Boolean));
    const candidates=[];
    try{
        for(const archiveId of fs.readdirSync(dir)){
            if(alreadyBound.has(String(archiveId)))continue;
            const manifest=readJson(cardArchiveManifestFile(characterKey,archiveId),null);
            if(!manifest?.cardVaultImportPending)continue;
            const originalKey=String(manifest.originalChatKey||manifest.chatKey||'');
            const originalName=String(manifest.originalChatName||manifest.chatName||'');
            const originalAnchor=String(manifest.originalChatAnchor||manifest.chatAnchor||'');
            let score=0;
            if(originalKey && originalKey===String(chatKey))score+=100;
            if(originalAnchor && chatAnchor && originalAnchor===String(chatAnchor))score+=70;
            if(originalName && chatName && originalName===String(chatName))score+=30;
            candidates.push({archiveId,manifest,score,originalName});
        }
    }catch{}
    candidates.sort((a,b)=>b.score-a.score);
    if(candidates[0]?.score>=70 && (!candidates[1]||candidates[0].score>candidates[1].score))return candidates[0];
    // Sau khi khôi phục, native chat id của ST có thể đổi; chỉ khi “tên cuộc trò chuyện khớp duy nhất” mới cho phép hạ cấp nối lại theo tên, tránh lẫn hồ sơ.
    const nameMatches=candidates.filter(row=>row.originalName && chatName && row.originalName===String(chatName));
    return nameMatches.length===1?nameMatches[0]:null;
}

function resolveCardArchive({characterKey,characterName='',characterId='',avatar='',chatKey,chatName='',chatAnchor='',archiveId='',create=true}={}) {
    if(!characterKey||!chatKey)throw new Error('characterKey-and-chatKey-required');
    const bindings=loadCardArchiveBindings();
    let binding=bindings.bindings[chatKey]||null;
    if(archiveId){
        const probe=readCardArchive(characterKey,archiveId);
        if(probe)binding={archiveId,characterKey};
    }
    if(binding && String(binding.characterKey||'')!==String(characterKey)) binding=null;
    if(!binding && create){
        const pending=findPendingCardVaultArchive({characterKey,chatKey,chatName,chatAnchor,bindings});
        if(pending){
            binding={archiveId:pending.archiveId,characterKey:String(characterKey),boundAt:Date.now(),characterName:String(characterName||pending.manifest?.characterName||''),chatKey:String(chatKey),restoredFromCardVault:true};
        }
    }
    if(!binding && create){
        const id=`archive-${crypto.randomUUID()}`;
        binding={archiveId:id,characterKey:String(characterKey),boundAt:Date.now(),characterName:String(characterName||''),chatKey:String(chatKey)};
    }
    if(!binding)return null;
    bindings.bindings[chatKey]={...binding,characterKey:String(characterKey),characterName:String(characterName||binding.characterName||''),chatKey:String(chatKey),chatName:String(chatName||''),chatAnchor:String(chatAnchor||''),updatedAt:Date.now()};
    saveCardArchiveBindings(bindings);
    const dir=cardArchiveDir(characterKey,binding.archiveId);fs.mkdirSync(dir,{recursive:true});
    let manifest=readJson(cardArchiveManifestFile(characterKey,binding.archiveId),null);
    if(!manifest){
        manifest={schema:'vvv-theater-card-archive-v1',archiveId:binding.archiveId,characterKey:String(characterKey),characterId:String(characterId||''),characterName:String(characterName||''),avatar:String(avatar||''),chatKey:String(chatKey),chatName:String(chatName||''),chatAnchor:String(chatAnchor||''),createdAt:Date.now(),updatedAt:Date.now(),boundAt:Date.now(),saveCount:0,lastReason:'created',metrics:{}};
        writeJsonAtomic(cardArchiveManifestFile(characterKey,binding.archiveId),manifest);
    } else {
        manifest={...manifest,characterId:String(characterId||manifest.characterId||''),characterName:String(characterName||manifest.characterName||''),avatar:String(avatar||manifest.avatar||''),chatKey:String(chatKey),chatName:String(chatName||manifest.chatName||''),chatAnchor:String(chatAnchor||manifest.chatAnchor||''),updatedAt:Date.now(),cardVaultImportPending:false,restoredFromCardVault:Boolean(binding.restoredFromCardVault||manifest.restoredFromCardVault)};
        writeJsonAtomic(cardArchiveManifestFile(characterKey,binding.archiveId),manifest);
    }
    const state=readJson(cardArchiveStateFile(characterKey,binding.archiveId),null);
    return {binding:{archiveId:binding.archiveId,characterKey:String(characterKey),boundAt:Number(manifest.boundAt||binding.boundAt||Date.now()),relativePath:path.relative(ROOT_DIR(),dir).replaceAll(path.sep,'/')},manifest,state};
}

function findCharacterArchiveKeyByIdentity({avatar='',characterName=''}={}) {
    const targetAvatar=String(avatar||'').trim();
    const targetName=String(characterName||'').trim();
    const root=CARD_ARCHIVE_DIR();
    let best=null;
    try {
        for(const charDir of fs.readdirSync(root,{withFileTypes:true})){
            if(!charDir.isDirectory()||!charDir.name.startsWith('character-'))continue;
            const base=path.join(root,charDir.name);
            for(const archiveDir of fs.readdirSync(base,{withFileTypes:true})){
                if(!archiveDir.isDirectory())continue;
                const manifest=readJson(path.join(base,archiveDir.name,'manifest.json'),null);
                if(!manifest?.characterKey)continue;
                const manifestAvatar=String(manifest.avatar||'').trim();
                const manifestName=String(manifest.characterName||'').trim();
                let score=0;
                if(targetAvatar&&manifestAvatar&&targetAvatar===manifestAvatar)score+=100;
                if(targetName&&manifestName&&targetName===manifestName)score+=20;
                if(!score)continue;
                const updatedAt=Number(manifest.updatedAt||manifest.createdAt||0);
                if(!best||score>best.score||(score===best.score&&updatedAt>best.updatedAt)){
                    best={characterKey:String(manifest.characterKey),score,updatedAt,manifest};
                }
            }
        }
    } catch {}
    return best;
}

function exportCharacterArchiveBundleByIdentity(identity={}) {
    const match=findCharacterArchiveKeyByIdentity(identity);
    if(!match?.characterKey)throw new Error('character-archive-not-found-by-identity');
    const bundle=exportCharacterArchiveBundle(match.characterKey);
    bundle.matchedBy={avatar:String(identity?.avatar||''),characterName:String(identity?.characterName||''),score:match.score};
    return bundle;
}

function exportCharacterArchiveBundle(characterKey) {
    const dir=cardCharacterDir(characterKey);const archives=[];
    try{for(const name of fs.readdirSync(dir)){const row=readCardArchive(characterKey,name);if(row?.manifest)archives.push({manifest:row.manifest,state:row.state});}}catch{}
    const characterName=archives.find(x=>x.manifest?.characterName)?.manifest?.characterName||'';
    return {schema:'vvv-theater-cardvault-bundle-v2',exportedAt:Date.now(),characterKey:String(characterKey),characterName,archivePolicy:{mode:'per-character-per-chat',appendOnly:true,noAutomaticDeletion:true,historyPruning:false},archives};
}

function importCharacterArchiveBundle(bundle, characterKey, characterName='', currentIdentity={}) {
    if(!bundle||!Array.isArray(bundle.archives))throw new Error('invalid-cardvault-bundle');
    const imported=[];
    for(const item of bundle.archives){
        if(!item?.state||typeof item.state!=='object')continue;
        const archiveId=`archive-${crypto.randomUUID()}`;
        const old=item.manifest||{};
        const identity={characterName:characterName||old.characterName||bundle.characterName||'',characterId:'',avatar:old.avatar||'',chatKey:`cardvault-pending:${archiveId}`,chatName:old.chatName||'Hồ sơ nhập từ CardVault',chatAnchor:old.chatAnchor||''};
        let manifest=writeCardArchiveState({characterKey,archiveId,state:item.state,reason:'cardvault-import',identity});
        manifest={...manifest,cardVaultImportPending:true,originalChatKey:String(old.chatKey||''),originalChatName:String(old.chatName||''),originalChatAnchor:String(old.chatAnchor||'')};
        writeJsonAtomic(cardArchiveManifestFile(characterKey,archiveId),manifest);
        imported.push({archiveId,manifest});
    }
    let reboundCurrentChat=null;
    const currentChatKey=String(currentIdentity?.chatKey||'');
    if(currentChatKey && imported.length){
        const pseudoBindings={bindings:{}};
        const pending=findPendingCardVaultArchive({characterKey,chatKey:currentChatKey,chatName:String(currentIdentity?.chatName||''),chatAnchor:String(currentIdentity?.chatAnchor||''),bindings:pseudoBindings});
        if(pending && imported.some(row=>row.archiveId===pending.archiveId)){
            const bindings=loadCardArchiveBindings();
            // Khôi phục CardVault tường minh cho phép cuộc trò chuyện hiện tại gắn lại sang hồ sơ vừa nhập; liên kết cũ chỉ mất “con trỏ hiện tại”, thư mục/dữ liệu tuyệt đối không bị xóa.
            bindings.bindings[currentChatKey]={archiveId:pending.archiveId,characterKey:String(characterKey),boundAt:Date.now(),characterName:String(characterName||pending.manifest?.characterName||''),chatKey:currentChatKey,chatName:String(currentIdentity?.chatName||''),chatAnchor:String(currentIdentity?.chatAnchor||''),updatedAt:Date.now(),restoredFromCardVault:true};
            saveCardArchiveBindings(bindings);
            let manifest=readJson(cardArchiveManifestFile(characterKey,pending.archiveId),pending.manifest)||pending.manifest;
            manifest={...manifest,chatKey:currentChatKey,chatName:String(currentIdentity?.chatName||manifest.chatName||''),chatAnchor:String(currentIdentity?.chatAnchor||manifest.chatAnchor||''),cardVaultImportPending:false,restoredFromCardVault:true,updatedAt:Date.now()};
            writeJsonAtomic(cardArchiveManifestFile(characterKey,pending.archiveId),manifest);
            reboundCurrentChat={archiveId:pending.archiveId,chatKey:currentChatKey};
        }
    }
    return {imported,reboundCurrentChat};
}

function stateChatDir(chatKey) {
    return path.join(STATE_DIR(), safeId(chatKey));
}

function stateUploadDir(chatKey, uploadId) {
    return path.join(STATE_UPLOAD_DIR(), safeId(chatKey), safeId(uploadId));
}

function cleanupStateUploads() {
    const cutoff = Date.now() - MAX_STATE_UPLOAD_AGE;
    try {
        for (const chatDirName of fs.readdirSync(STATE_UPLOAD_DIR())) {
            const chatDir = path.join(STATE_UPLOAD_DIR(), chatDirName);
            let children = []; try { children = fs.readdirSync(chatDir); } catch { continue; }
            for (const uploadName of children) {
                const dir = path.join(chatDir, uploadName);
                try { if (fs.statSync(dir).mtimeMs < cutoff) fs.rmSync(dir, { recursive:true, force:true }); } catch {}
            }
            try { if (!fs.readdirSync(chatDir).length) fs.rmdirSync(chatDir); } catch {}
        }
    } catch {}
}

function cleanupCardArchiveUploads() {
    const cutoff=Date.now()-MAX_STATE_UPLOAD_AGE;
    try{for(const name of fs.readdirSync(CARD_ARCHIVE_UPLOAD_DIR())){const dir=path.join(CARD_ARCHIVE_UPLOAD_DIR(),name);try{if(fs.statSync(dir).mtimeMs<cutoff)fs.rmSync(dir,{recursive:true,force:true})}catch{}}}catch{}
}

function stateSnapshotList(chatKey) {
    const dir = stateChatDir(chatKey);
    try {
        return fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => {
            const file = path.join(dir, name);
            const stat = fs.statSync(file);
            return { id: name.slice(0, -5), file, mtimeMs: stat.mtimeMs, size: stat.size };
        }).sort((a,b) => b.mtimeMs - a.mtimeMs);
    } catch { return []; }
}

function snapshotMetrics(state) {
    const tables = state?.tables || {};
    const tableRows = Object.values(tables).reduce((n, rows) => n + (Array.isArray(rows) ? rows.length : 0), 0);
    const phone = ['wechat','wechatGroups','sms','calls','threads','groupThreads'].reduce((n,key)=>n+(Array.isArray(state?.phone?.[key])?state.phone[key].length:0),0);
    const world = (Array.isArray(state?.characterWorld?.events)?state.characterWorld.events.length:0) + (Array.isArray(state?.characterWorld?.characters)?state.characterWorld.characters.length:0);
    return {
        rows: tableRows, tableRows,
        summaries: Array.isArray(tables.summaries) ? tables.summaries.length : 0,
        anchors: Array.isArray(state?.memoryAnchors) ? state.memoryAnchors.length : 0,
        episodeFacts: Array.isArray(state?.episodeFacts) ? state.episodeFacts.length : 0,
        lifeFacts: Array.isArray(state?.lifeFacts) ? state.lifeFacts.length : 0,
        factConflicts: Array.isArray(state?.factConflicts) ? state.factConflicts.length : 0,
        appearances: Array.isArray(state?.appearances) ? state.appearances.length : 0,
        chapters: Array.isArray(state?.chapters) ? state.chapters.length : 0,
        phone, world,
        updatedAt: Number(state?.updatedAt || 0),
        version: String(state?.version || ''),
    };
}

function writeStateSnapshot(chatKey, state, reason='auto') {
    if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('invalid-state');
    const envelope = {
        version: VERSION, chatKey: String(chatKey), reason: String(reason || 'auto').slice(0,120),
        createdAt: Date.now(), metrics: snapshotMetrics(state), state,
    };
    const raw = JSON.stringify(envelope);
    if (Buffer.byteLength(raw, 'utf8') > MAX_STATE_BYTES) throw new Error(`state-too-large>${MAX_STATE_BYTES}`);
    const dir = stateChatDir(chatKey);
    fs.mkdirSync(dir, { recursive: true });
    const hash = crypto.createHash('sha256').update(raw).digest('hex').slice(0,12);
    const id = `${Date.now()}-${hash}`;
    writeJsonAtomic(path.join(dir, `${id}.json`), envelope);
    return { id, createdAt: envelope.createdAt, reason: envelope.reason, metrics: envelope.metrics };
}

function normalizeBaseUrl(value) {
    return String(value || '').trim().replace(/\/+$/, '');
}

function joinUrl(base, suffix) {
    const clean = normalizeBaseUrl(base);
    if (!clean) throw new Error('Chưa điền Base URL');
    if (clean.endsWith(suffix)) return clean;
    return `${clean}${suffix.startsWith('/') ? '' : '/'}${suffix}`;
}

function timeoutSignal(seconds) {
    return AbortSignal.timeout(Math.max(5, Number(seconds || 120)) * 1000);
}

function headersWithExtra(base, extra) {
    const result = { ...base };
    if (extra && typeof extra === 'object') {
        for (const [key, value] of Object.entries(extra)) {
            if (value !== undefined && value !== null && String(value).trim()) result[String(key)] = String(value);
        }
    }
    return result;
}

async function fetchJson(url, options) {
    const response = await fetch(url, options);
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!response.ok) {
        const message = data?.error?.message || data?.message || data?.error || data?.raw || `HTTP ${response.status}`;
        const retryAfter = response.headers.get('retry-after');
        const suffix = retryAfter ? ` · Retry-After=${retryAfter}s` : '';
        throw new Error(`HTTP ${response.status}: ${String(message).slice(0, 1100)}${suffix}`);
    }
    return { data, response };
}

function pickFeatureModel(config, feature) {
    return String(config.llm.featureModels?.[feature] || config.llm.model || '').trim();
}

function contentToText(content) {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';
    return content.map(item => typeof item === 'string' ? item : item?.text || item?.content || '').join('');
}

function redactControlAgentText(value) {
    return String(value || '').replace(/((?:api[_ -]?key|authorization|bearer|access[_ -]?token|refresh[_ -]?token|token|password|passwd|cookie|secret)\s*[:=]\s*)([^\s,;]+)/gi, '$1[đã che thông tin nhạy cảm]');
}

function decodeControlAgentImagePart(part) {
    const candidate = part?.image_url?.url ?? part?.url ?? part?.data;
    const raw = String(candidate || '').trim();
    const match = raw.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i);
    if (!match) return null;
    const mime = match[1].toLowerCase();
    if (!CONTROL_AGENT_IMAGE_MIMES.has(mime)) return null;
    const encoded = match[2].replace(/\s+/g, '');
    if (!encoded || encoded.length > Math.ceil(CONTROL_AGENT_MAX_IMAGE_BYTES * 4 / 3) + 16) return null;
    let buffer;
    try { buffer = Buffer.from(encoded, 'base64'); } catch { return null; }
    if (!buffer.length || buffer.length > CONTROL_AGENT_MAX_IMAGE_BYTES) return null;
    return { type: 'image', mimeType: mime, data: encoded, bytes: buffer.length };
}

function decodeControlAgentDocumentPart(part) {
    const name = String(part?.name || 'Tài liệu chưa đặt tên').replace(/[\u0000-\u001f\\/]/g, '_').slice(0, 160);
    const mime = controlAgentMimeType(name, part?.mimeType || part?.mime);
    if (!CONTROL_AGENT_DOCUMENT_MIMES.has(mime)) return null;
    const raw = String(part?.data || '').trim().replace(/^data:[^,]+,/, '').replace(/\s+/g, '');
    if (!raw || !/^[a-z0-9+/=]+$/i.test(raw)) return null;
    if (raw.length > Math.ceil(CONTROL_AGENT_MAX_IMAGE_BYTES * 4 / 3) + 16) return null;
    let buffer;
    try { buffer = Buffer.from(raw, 'base64'); } catch { return null; }
    if (!buffer.length || buffer.length > CONTROL_AGENT_MAX_IMAGE_BYTES) return null;
    return { type: 'document', mimeType: mime, data: raw, bytes: buffer.length, name };
}

function normalizeControlAgentContent(content, state) {
    const parts = Array.isArray(content) ? content : [{ type: 'text', text: String(content || '') }];
    const output = [];
    for (const part of parts.slice(0, CONTROL_AGENT_MAX_ATTACHMENTS + 20)) {
        if (typeof part === 'string') {
            const text = String(part).replace(/\u0000/g, '').trim();
            if (text) output.push({ type: 'text', text });
            continue;
        }
        if (!part || typeof part !== 'object') continue;
        const type = String(part.type || '').toLowerCase();
        if (type === 'text') {
            const text = String(part.text ?? part.content ?? '').replace(/\u0000/g, '').trim();
            if (text) output.push({ type: 'text', text });
            continue;
        }
        if (type === 'image' || type === 'image_url') {
            const image = decodeControlAgentImagePart(part);
            if (!image) throw new Error('Định dạng ảnh đính kèm không hợp lệ: chỉ chấp nhận data URL PNG/JPEG/WebP/GIF/BMP/AVIF trong danh sách cho phép');
            if (state.attachmentCount >= CONTROL_AGENT_MAX_ATTACHMENTS) throw new Error(`Số tệp đính kèm vượt quá ${CONTROL_AGENT_MAX_ATTACHMENTS}`);
            if (state.attachmentBytes + image.bytes > CONTROL_AGENT_MAX_ATTACHMENT_TOTAL_BYTES) throw new Error('Tổng dung lượng tệp đính kèm vượt giới hạn 12MB');
            state.attachmentCount += 1; state.attachmentBytes += image.bytes;
            output.push(image);
            continue;
        }
        // Tệp không được ghi xuống đĩa của máy chủ. Giao diện chỉ tạo tóm tắt cho tệp văn bản; tệp nhị phân lạ chỉ giữ lại tên và dung lượng.
        if (type === 'file' || type === 'document') {
            const name = String(part.name || 'Tệp chưa đặt tên').replace(/[\u0000-\u001f\\/]/g, '_').slice(0, 160);
            const mimeType = controlAgentMimeType(name, part.mimeType || part.mime).slice(0, 120);
            const size = Math.max(0, Number(part.size || 0));
            const document = type === 'document' ? decodeControlAgentDocumentPart(part) : null;
            if (document) {
                if (state.attachmentCount >= CONTROL_AGENT_MAX_ATTACHMENTS) throw new Error(`Số tệp đính kèm vượt quá ${CONTROL_AGENT_MAX_ATTACHMENTS}`);
                if (state.attachmentBytes + document.bytes > CONTROL_AGENT_MAX_ATTACHMENT_TOTAL_BYTES) throw new Error('Tổng dung lượng tệp đính kèm vượt giới hạn 12MB');
                state.attachmentCount += 1; state.attachmentBytes += document.bytes;
                output.push(document);
                continue;
            }
            if (type === 'document') throw new Error('Định dạng tài liệu đính kèm không hợp lệ: PDF phải được cung cấp dưới dạng base64 nội tuyến');
            if (state.attachmentCount >= CONTROL_AGENT_MAX_ATTACHMENTS) throw new Error(`Số tệp đính kèm vượt quá ${CONTROL_AGENT_MAX_ATTACHMENTS}`);
            const declaredBytes = Number.isFinite(size) ? Math.max(0, size) : 0;
            const extension = String(name).toLowerCase().match(/\.([a-z0-9]{1,12})$/)?.[1] || '';
            const textAllowed = CONTROL_AGENT_TEXT_MIMES.has(mimeType) || CONTROL_AGENT_TEXT_EXTENSIONS.has(extension);
            const suppliedText = textAllowed ? String(part.text || '').replace(/\u0000/g, '') : '';
            const redactedText = suppliedText ? redactControlAgentText(suppliedText) : '';
            const textBytes = Buffer.byteLength(redactedText, 'utf8');
            const text = textBytes > CONTROL_AGENT_MAX_TEXT_BYTES
                ? Buffer.from(redactedText, 'utf8').subarray(0, CONTROL_AGENT_MAX_TEXT_BYTES).toString('utf8')
                : redactedText;
            // Count the actual UTF-8 payload, never a client-supplied `size`,
            // so a forged metadata value cannot bypass the aggregate limit.
            const accountedBytes = textAllowed ? Math.min(textBytes, CONTROL_AGENT_MAX_TEXT_BYTES) : Math.min(declaredBytes, CONTROL_AGENT_MAX_TEXT_BYTES);
            if (state.attachmentBytes + accountedBytes > CONTROL_AGENT_MAX_ATTACHMENT_TOTAL_BYTES) throw new Error('Tổng dung lượng tệp đính kèm vượt giới hạn 12MB');
            state.attachmentCount += 1; state.attachmentBytes += accountedBytes;
            const descriptor = text
                ? `【ĐÍNH KÈM: ${name}｜${mimeType}｜${size} byte｜tóm tắt văn bản đã che thông tin nhạy cảm】\n${text}`
                : `【ĐÍNH KÈM: ${name}｜${mimeType}｜${size} byte】\nTệp này không thuộc định dạng văn bản được hỗ trợ; máy chủ không đọc và không lưu nội dung nhị phân của nó.`;
            output.push({ type: 'text', text: descriptor });
        }
    }
    return output;
}

function normalizeStructuredMessages(input, maxTotalChars = 2_000_000, options = {}) {
    if (!Array.isArray(input)) return [];
    const messages = [];
    let used = 0;
    const allowRichContent = options?.allowRichContent === true;
    const attachmentState = { attachmentCount: 0, attachmentBytes: 0 };
    for (const item of input.slice(0, 600)) {
        let role = String(item?.role || '').toLowerCase();
        if (role === 'model') role = 'assistant';
        if (role === 'developer') role = 'system';
        if (!['system','user','assistant'].includes(role)) continue;
        const rawContent = item?.content ?? item?.mes;
        const content = allowRichContent
            ? normalizeControlAgentContent(rawContent, attachmentState)
            : contentToText(rawContent).replace(/\u0000/g, '').trim();
        const contentText = contentToText(content).replace(/\u0000/g, '').trim();
        // Rich attachments carry no textual characters by themselves. Keep
        // image and PDF document parts so vision/document-capable providers
        // receive the user's upload instead of an empty message being dropped.
        if (!contentText && !(Array.isArray(content) && content.some(part => part.type === 'image' || part.type === 'document'))) continue;
        const remaining = Math.max(0, maxTotalChars - used);
        if (!remaining) break;
        const row = { role, content:typeof content === 'string' ? content.slice(0, remaining) : content };
        const name = String(item?.name || '').trim();
        if (name && /^[A-Za-z0-9_-]{1,64}$/.test(name)) row.name = name;
        messages.push(row);
        used += contentText.length;
    }
    return messages;
}

function withFictionContextMessages(input) {
    const messages = normalizeStructuredMessages(input);
    if (messages.some(message => message.content.includes(FICTION_CONTEXT_MARKER))) return messages;
    return [{ role:'system', content:FICTION_CONTEXT }, ...messages];
}

function resolveLlmMessages({ messages, prompt = '', systemPrompt = '', allowRichContent = false } = {}) {
    const structured = normalizeStructuredMessages(messages, 2_000_000, { allowRichContent });
    if (structured.length) {
        const system = String(systemPrompt || '').trim();
        const user = String(prompt || '').trim();
        if (system) structured.unshift({ role:'system', content:system });
        if (user) structured.push({ role:'user', content:user });
        return structured;
    }
    return [
        ...(String(systemPrompt || '').trim() ? [{ role:'system', content:String(systemPrompt).trim() }] : []),
        ...(String(prompt || '').trim() ? [{ role:'user', content:String(prompt).trim() }] : []),
    ];
}

function providerConversation(messages, assistantRole = 'assistant') {
    const output = [];
    for (const message of messages.filter(item => item.role !== 'system')) {
        const role = message.role === 'assistant' ? assistantRole : 'user';
        const named = message.name
            ? [{ type: 'text', text: `${message.name}: ` }, ...internalContentParts(message.content)]
            : internalContentParts(message.content);
        const last = output.at(-1);
        if (last?.role === role) last.content = mergeInternalContent(last.content, [{ type: 'text', text: '\n\n' }, ...named]);
        else output.push({ role, content:internalContentValue(named) });
    }
    if (!output.length) output.push({ role:'user', content:'Hãy thực hiện nhiệm vụ viết hiện tại nêu trong tin nhắn hệ thống.' });
    if (output[0].role === assistantRole) output.unshift({ role:'user', content:'Dưới đây là ngữ cảnh hội thoại đã có.' });
    return output;
}

function providerSystemText(messages, jsonMode = false) {
    const system = messages.map((message, index) => message.role === 'system' ? `【System ${index + 1}】\n${contentToText(message.content)}` : '').filter(Boolean);
    if (jsonMode) system.push('Chỉ xuất đúng một đối tượng JSON hợp lệ, không dùng khối mã Markdown, không giải thích, không có chữ nào ngoài đối tượng.');
    return system.join('\n\n');
}

function internalContentParts(content) {
    if (typeof content === 'string') return content ? [{ type: 'text', text: content }] : [];
    if (!Array.isArray(content)) return [];
    return content.filter(part => part && typeof part === 'object' && (part.type === 'text' || part.type === 'image' || part.type === 'document'))
        .map(part => part.type === 'image'
            ? { type: 'image', mimeType: String(part.mimeType || 'image/png'), data: String(part.data || '') }
            : part.type === 'document'
                ? { type: 'document', mimeType: String(part.mimeType || 'application/pdf'), data: String(part.data || ''), name: String(part.name || 'Tài liệu chưa đặt tên') }
            : { type: 'text', text: String(part.text || '') })
        .filter(part => (part.type === 'image' || part.type === 'document') ? Boolean(part.data) : Boolean(part.text));
}

function internalContentValue(parts) {
    const list = internalContentParts(parts);
    return list.some(part => part.type === 'image' || part.type === 'document') ? list : list.map(part => part.text).join('');
}

function mergeInternalContent(left, right) {
    return internalContentValue([...internalContentParts(left), ...internalContentParts(right)]);
}

function openAiMessageContent(content) {
    if (typeof content === 'string') return content;
    return internalContentParts(content).map(part => part.type === 'image'
        ? { type: 'image_url', image_url: { url: `data:${part.mimeType};base64,${part.data}` } }
        : part.type === 'document'
            ? { type: 'text', text: `【TÀI LIỆU ĐÍNH KÈM: ${part.name || 'Tài liệu chưa đặt tên'}｜${part.mimeType}】\nGiao diện Chat Completions tương thích OpenAI hiện không bật lưu trữ tệp gốc; tài liệu không được tải lên dưới dạng nhị phân. Hãy đổi sang mô hình Gemini/Anthropic đọc được PDF, hoặc xuất tài liệu ra dạng văn bản.` }
        : { type: 'text', text: part.text });
}

function anthropicMessageContent(content) {
    if (typeof content === 'string') return content;
    return internalContentParts(content).map(part => part.type === 'image'
        ? { type: 'image', source: { type: 'base64', media_type: part.mimeType, data: part.data } }
        : part.type === 'document'
            ? { type: 'document', source: { type: 'base64', media_type: part.mimeType, data: part.data }, title: part.name || undefined }
        : { type: 'text', text: part.text });
}

function geminiMessageParts(content) {
    return internalContentParts(content).map(part => part.type === 'image'
        ? { inline_data: { mime_type: part.mimeType, data: part.data } }
        : part.type === 'document'
            ? { inline_data: { mime_type: part.mimeType, data: part.data } }
        : { text: part.text });
}

async function callOpenAiCompatible(config, { prompt, systemPrompt = '', messages = null, feature = 'extract', jsonMode = false }) {
    const model = pickFeatureModel(config, feature);
    if (!model) throw new Error('Chưa điền tên mô hình');
    const base = normalizeBaseUrl(config.llm.baseUrl);
    const url = /\/chat\/completions$/i.test(base) ? base : joinUrl(base, '/chat/completions');
    const headers = headersWithExtra({ 'content-type': 'application/json' }, config.llm.extraHeaders);
    if (config.llm.apiKey) headers.authorization = `Bearer ${config.llm.apiKey}`;
    const body = {
        model,
        messages: resolveLlmMessages({ messages, prompt, systemPrompt, allowRichContent: feature === 'controlAgent' }).map(message => ({
            ...message,
            content: openAiMessageContent(message.content),
        })),
        temperature: Number(config.llm.temperature ?? 0.15),
        max_tokens: Number(config.llm.maxTokens || 4000),
        stream: false,
    };
    if(jsonMode)body.response_format={type:'json_object'};
    // Hai yêu cầu tương thích JSON-mode dùng chung một hạn chót tổng, tránh việc response_format
    // không tương thích lại âm thầm nhân đôi ngân sách 75 giây thành 150 giây.
    const signal=timeoutSignal(config.llm.timeoutSeconds);
    let response;
    try{response=await fetchJson(url,{method:'POST',headers,body:JSON.stringify(body),signal});}
    catch(error){
        if(!jsonMode||!/response[_ -]?format|json[_ -]?mode|unsupported|not supported|unknown (?:field|parameter)/i.test(String(error?.message||error)))throw error;
        delete body.response_format;
        response=await fetchJson(url,{method:'POST',headers,body:JSON.stringify(body),signal});
    }
    const { data }=response;
    const text = contentToText(data?.choices?.[0]?.message?.content)
        || contentToText(data?.choices?.[0]?.text)
        || String(data?.output_text || data?.response || '');
    if (!text.trim()) throw new Error('Mô hình không trả về văn bản');
    return { text, model, usage: data?.usage || null, provider: 'openai-compatible', finishReason:String(data?.choices?.[0]?.finish_reason||data?.finish_reason||'') };
}

async function callAnthropic(config, { prompt, systemPrompt = '', messages = null, feature = 'extract', jsonMode = false }) {
    const model = pickFeatureModel(config, feature);
    if (!model) throw new Error('Chưa điền tên mô hình');
    const base = normalizeBaseUrl(config.llm.baseUrl || 'https://api.anthropic.com/v1');
    const url = /\/messages$/i.test(base) ? base : joinUrl(base, '/messages');
    const headers = headersWithExtra({
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': config.llm.apiKey || '',
    }, config.llm.extraHeaders);
    const prepared = resolveLlmMessages({ messages, prompt, systemPrompt, allowRichContent: feature === 'controlAgent' });
    const { data } = await fetchJson(url, {
        method: 'POST', headers,
        body: JSON.stringify({
            model,
            system: providerSystemText(prepared, jsonMode) || undefined,
            messages: providerConversation(prepared).map(message => ({ ...message, content: anthropicMessageContent(message.content) })),
            temperature: Number(config.llm.temperature ?? 0.15),
            max_tokens: Number(config.llm.maxTokens || 4000),
        }),
        signal: timeoutSignal(config.llm.timeoutSeconds),
    });
    const text = contentToText(data?.content);
    if (!text.trim()) throw new Error('Mô hình không trả về văn bản');
    return { text, model, usage: data?.usage || null, provider: 'anthropic', finishReason:String(data?.stop_reason||'') };
}

async function callGemini(config, { prompt, systemPrompt = '', messages = null, feature = 'extract', jsonMode = false }) {
    const model = pickFeatureModel(config, feature);
    if (!model) throw new Error('Chưa điền tên mô hình');
    const base = normalizeBaseUrl(config.llm.baseUrl || 'https://generativelanguage.googleapis.com/v1beta');
    const modelPath = model.startsWith('models/') ? model : `models/${model}`;
    const url = `${base}/${modelPath}:generateContent${config.llm.apiKey ? `?key=${encodeURIComponent(config.llm.apiKey)}` : ''}`;
    const headers = headersWithExtra({ 'content-type': 'application/json' }, config.llm.extraHeaders);
    const prepared = resolveLlmMessages({ messages, prompt, systemPrompt, allowRichContent: feature === 'controlAgent' });
    const contents = providerConversation(prepared, 'model').map(message => ({ role:message.role, parts:geminiMessageParts(message.content) }));
    const body = {
        contents,
        generationConfig: {
            temperature: Number(config.llm.temperature ?? 0.15),
            maxOutputTokens: Number(config.llm.maxTokens || 4000),
            ...(jsonMode?{responseMimeType:'application/json'}:{}),
        },
    };
    const systemInstruction = providerSystemText(prepared, jsonMode);
    if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] };
    const { data } = await fetchJson(url, {
        method: 'POST', headers, body: JSON.stringify(body), signal: timeoutSignal(config.llm.timeoutSeconds),
    });
    const text = contentToText(data?.candidates?.[0]?.content?.parts);
    if (!text.trim()) throw new Error('Mô hình không trả về văn bản');
    return { text, model, usage: data?.usageMetadata || null, provider: 'gemini', finishReason:String(data?.candidates?.[0]?.finishReason||'') };
}

async function callLlmDirect(config, payload) {
    const provider = String(config.llm.provider || 'openai-compatible').toLowerCase();
    if (provider === 'anthropic') return callAnthropic(config, payload);
    if (provider === 'gemini') return callGemini(config, payload);
    return callOpenAiCompatible(config, payload);
}


// Nghiệm thu kết quả JSON của API đơn: vẫn sửa định dạng, nhưng không còn điều phối đa nguồn hay chuyển đổi giữa các trạm.
function normalizeJsonObjectText(text){
    const raw=String(text??'').trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/i,'');
    const candidates=[raw];
    for(let start=raw.indexOf('{');start>=0;start=raw.indexOf('{',start+1)){
        let depth=0,inString=false,escaped=false;
        for(let i=start;i<raw.length;i+=1){
            const ch=raw[i];
            if(inString){if(escaped){escaped=false;continue;}if(ch==='\\'){escaped=true;continue;}if(ch==='"')inString=false;continue;}
            if(ch==='"'){inString=true;continue;}
            if(ch==='{')depth+=1;
            else if(ch==='}'&&--depth===0){candidates.push(raw.slice(start,i+1));break;}
        }
    }
    for(const candidate of candidates){
        try{const parsed=JSON.parse(candidate);if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))return JSON.stringify(parsed);}catch{}
    }
    const error=new Error(`Mô hình không trả về đối tượng JSON hợp lệ: ${raw.replace(/\s+/g,' ').slice(0,220)||'phản hồi rỗng'}`);
    error.name='ModelJsonFormatError';
    throw error;
}
function isProviderPolicyRefusalText(value){
    const text=String(value||'');
    return /prompt could not be submitted|contains? sensitive words?|generative AI prohibited use policy|prohibited use policy|content policy (?:violation|blocked|refusal)|blocked (?:by|due to) safety|finishReason["':\s]+SAFETY|không gửi được nội dung nhắc|chứa từ nhạy cảm|chính sách cấm sử dụng.*AI tạo sinh|vi phạm chính sách.*(?:nội dung|sử dụng)|bị.*(?:kiểm duyệt|hệ thống) an toàn.*chặn/i.test(text);
}
function publicGenerationError(error,{fallbackMessage='Yêu cầu sinh nội dung thất bại',fallbackCode='generation-request-failed'}={}){
    const message=String(error?.message||error||fallbackMessage);
    const policyRefusal=error?.policyRefusal===true||String(error?.name||'')==='ProviderPolicyRefusalError'||String(error?.code||'')==='provider-policy-refusal'||isProviderPolicyRefusalText(message);
    return {
        message,
        name:policyRefusal?'ProviderPolicyRefusalError':String(error?.name||'Error'),
        code:policyRefusal?'provider-policy-refusal':(String(error?.name||'Error')==='ModelJsonFormatError'?'model-json-format':fallbackCode),
        policyRefusal,
    };
}
function publicCompanionError(error){return publicGenerationError(error,{fallbackMessage:'Yêu cầu Bảy điều hậu trường thất bại',fallbackCode:'companion-request-failed'});}
function publicRelayError(error){return publicGenerationError(error,{fallbackMessage:'Yêu cầu Tiếp sức AI thất bại',fallbackCode:'relay-request-failed'});}
function publicPhoneError(error){return publicGenerationError(error,{fallbackMessage:'Yêu cầu điện thoại thời gian thực thất bại',fallbackCode:'phone-request-failed'});}
function enforceJsonResult(result,payload){
    if(!payload?.jsonMode)return result;
    try{return {...result,text:normalizeJsonObjectText(result?.text)};}
    catch(error){
        if(String(payload?.feature||'')!=='controlAgent'||String(error?.name||'')!=='ModelJsonFormatError')throw error;
        const raw=String(result?.text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/i,'').trim();
        if(!raw)throw error;
        // Quản gia AI là lối vào chẩn đoán tương tác: một số mô hình thị giác dù nhận JSON mode vẫn trả về văn bản thuần khi xem ảnh.
        // Khi đó hạ cấp thành “chỉ trả lời, không hành động”, tuyệt đối không diễn giải văn bản phi cấu trúc thành thao tác chạy được.
        return {...result,text:JSON.stringify({reply:raw.slice(0,20000),actions:[],validationPlan:[]}),jsonFallback:true};
    }
}
function isControlAgentInputOverflow(error){
    return /input token count exceeds|maximum number of tokens allowed|context length exceeded|maximum context length|too many tokens|prompt (?:is )?too long|request too large|context[_ -]?length/i.test(String(error?.message||error||''));
}
function controlAgentRawImageParts(messages){
    const images=[];
    for(const message of Array.isArray(messages)?messages:[]){
        if(!Array.isArray(message?.content))continue;
        for(const part of message.content){
            const type=String(part?.type||'').toLowerCase();
            if((type==='image'||type==='image_url')&&decodeControlAgentImagePart(part))images.push(part);
        }
    }
    return images;
}
function controlAgentReplaceImagesWithSummaries(messages,summaries=[]){
    let cursor=0;
    return (Array.isArray(messages)?messages:[]).map(message=>{
        if(!Array.isArray(message?.content))return message;
        const content=[];
        for(const part of message.content){
            const type=String(part?.type||'').toLowerCase();
            if(type==='image'||type==='image_url'){
                const summary=String(summaries[cursor]||`Không đọc riêng được ảnh ${cursor+1}, hãy kết hợp các tệp đính kèm còn lại và mô tả của người dùng để tiếp tục chẩn đoán.`).slice(0,7000);
                content.push({type:'text',text:`【TÓM TẮT THỊ GIÁC ẢNH ${cursor+1}｜do Quản gia tự đọc theo lô】\n${summary}`});cursor+=1;
            }else content.push(part);
        }
        return {...message,content};
    });
}
function compactControlAgentMessagesForRetry(messages,maxTotal=90000){
    const rows=Array.isArray(messages)?messages:[];
    const selected=[];
    const firstSystem=rows.find(row=>String(row?.role||'').toLowerCase()==='system');
    if(firstSystem)selected.push(firstSystem);
    for(const row of rows.slice(-6))if(row!==firstSystem)selected.push(row);
    let remaining=maxTotal;
    return selected.map(row=>{
        const content=Array.isArray(row?.content)?row.content.map(part=>{
            if(String(part?.type||'').toLowerCase()!=='text')return part;
            const text=String(part?.text||part?.content||'');const clipped=text.slice(0,Math.max(0,Math.min(16000,remaining)));remaining=Math.max(0,remaining-clipped.length);return {...part,text:clipped};
        }):String(row?.content||'').slice(0,Math.max(0,Math.min(16000,remaining)));
        if(typeof content==='string')remaining=Math.max(0,remaining-content.length);
        return {...row,content};
    });
}
async function summarizeControlAgentImage(config,imagePart,index,total){
    const compact=cloneConfigWithLlm(config,{maxTokens:1800,timeoutSeconds:Math.max(60,Math.min(180,Number(config?.llm?.timeoutSeconds||180)))});
    const payload={feature:'controlAgent',jsonMode:false,messages:[{role:'user',content:[{type:'text',text:`Đây là ảnh thứ ${index+1}/${total} người dùng tải lên lần này. Hãy đọc chính xác giao diện, chữ, thông báo lỗi, vị trí các nút và vùng người dùng khoanh tròn/chỉ mũi tên trong ảnh. Chỉ xuất bản tóm tắt sự thật bằng tiếng Việt, ưu tiên giữ lại chữ và hiện tượng có ích cho việc chẩn đoán về sau; đừng đưa ra phương án sửa cuối cùng.`},imagePart]}]};
    const result=await callLlmDirect(compact,payload);
    return String(result?.text||'').trim().slice(0,7000)||`Ảnh thứ ${index+1} không trả về bản tóm tắt đọc được.`;
}
async function callControlAgentResilient(config,payload){
    const images=controlAgentRawImageParts(payload?.messages);
    // Nhiều ảnh thì luôn đọc từng ảnh rồi mới tổng hợp, tránh việc một trạm trung chuyển tương thích nào đó gộp nhiều base64 thành văn bản và tính hết vào ngữ cảnh một lần.
    if(images.length>=2){
        const summaries=[];
        for(let i=0;i<images.length;i+=1){
            try{summaries.push(await summarizeControlAgentImage(config,images[i],i,images.length));}
            catch(error){summaries.push(`Đọc ảnh thứ ${i+1} thất bại: ${String(error?.message||error).slice(0,800)}. Hãy tiếp tục phân tích dựa trên các ảnh khác, dữ liệu nhúng trong thẻ nhân vật và phần chữ của người dùng.`);}
        }
        const reduced={...payload,messages:controlAgentReplaceImagesWithSummaries(payload.messages,summaries)};
        try{return enforceJsonResult(await callLlmDirect(config,reduced),reduced);}
        catch(error){
            if(!isControlAgentInputOverflow(error))throw error;
            const compact={...reduced,messages:compactControlAgentMessagesForRetry(reduced.messages)};
            return enforceJsonResult(await callLlmDirect(config,compact),compact);
        }
    }
    try{return enforceJsonResult(await callLlmDirect(config,payload),payload);}
    catch(error){
        if(!isControlAgentInputOverflow(error)||images.length!==1)throw error;
        let summary;
        try{summary=await summarizeControlAgentImage(config,images[0],0,1);}
        catch(summaryError){throw error;}
        const reduced={...payload,messages:controlAgentReplaceImagesWithSummaries(payload.messages,[summary])};
        try{return enforceJsonResult(await callLlmDirect(config,reduced),reduced);}
        catch(retryError){
            if(!isControlAgentInputOverflow(retryError))throw retryError;
            const compact={...reduced,messages:compactControlAgentMessagesForRetry(reduced.messages)};
            return enforceJsonResult(await callLlmDirect(config,compact),compact);
        }
    }
}
async function callLlm(config,payload){
    if(String(payload?.feature||'')==='controlAgent')return callControlAgentResilient(config,payload);
    return enforceJsonResult(await callLlmDirect(config,payload),payload);
}

function relayCallConfig(config) {
    const relay = config?.relay || {};
    return {
        ...config,
        llm: {
            provider: relay.provider || 'openai-compatible',
            baseUrl: relay.baseUrl || '',
            apiKey: relay.apiKey || '',
            model: relay.model || '',
            temperature: Number(relay.temperature ?? 0.35),
            maxTokens: Number(relay.maxTokens || 1600),
            timeoutSeconds: Number(relay.timeoutSeconds || 180),
            extraHeaders: relay.extraHeaders || {},
            featureModels: { relay: relay.model || '' },
        },
    };
}

function relayConfigured(config) {
    const effective = relayCallConfig(config);
    const provider = String(effective?.llm?.provider || 'openai-compatible').toLowerCase();
    const model = String(effective?.llm?.model || '').trim();
    if (!model) return false;
    if (provider === 'anthropic' || provider === 'gemini') return true;
    return Boolean(String(effective?.llm?.baseUrl || '').trim());
}

function companionCallConfig(config) {
    const companion = config?.companion || {};
    return {
        ...config,
        llm: {
            provider: companion.provider || 'openai-compatible',
            baseUrl: companion.baseUrl || '',
            apiKey: companion.apiKey || '',
            model: companion.model || '',
            temperature: Number(companion.temperature ?? 0.18),
            maxTokens: Number(companion.maxTokens || 7000),
            timeoutSeconds: Number(companion.timeoutSeconds || 180),
            extraHeaders: companion.extraHeaders || {},
            featureModels: { companion: companion.model || '' },
        },
    };
}

function companionConfigured(config) {
    const effective = companionCallConfig(config);
    const provider = String(effective?.llm?.provider || 'openai-compatible').toLowerCase();
    const model = String(effective?.llm?.model || '').trim();
    if (!model) return false;
    if (provider === 'anthropic' || provider === 'gemini') return true;
    return Boolean(String(effective?.llm?.baseUrl || '').trim());
}

function phoneCallConfig(config) {
    const phone = config?.phone || {};
    return {
        ...config,
        llm: {
            provider: phone.provider || 'openai-compatible',
            baseUrl: phone.baseUrl || '',
            apiKey: phone.apiKey || '',
            model: phone.model || '',
            temperature: Number(phone.temperature ?? 0.55),
            maxTokens: Number(phone.maxTokens || 1200),
            timeoutSeconds: Number(phone.timeoutSeconds || 90),
            extraHeaders: phone.extraHeaders || {},
            featureModels: { phone: phone.model || '' },
        },
    };
}

function phoneConfigured(config) {
    if(config?.phone?.enabled===false)return false;
    const effective=phoneCallConfig(config);
    const provider=String(effective?.llm?.provider||'openai-compatible').toLowerCase();
    const model=String(effective?.llm?.model||'').trim();
    if(!model)return false;
    if(provider==='anthropic'||provider==='gemini')return true;
    return Boolean(String(effective?.llm?.baseUrl||'').trim());
}

function controlAgentCallConfig(config) {
    const agent=config?.controlAgent||{};
    return {
        ...config,
        llm: {
            provider:agent.provider||'openai-compatible',
            baseUrl:agent.baseUrl||'',
            apiKey:agent.apiKey||'',
            model:agent.model||'',
            temperature:Number(agent.temperature??0.2),
            maxTokens:Number(agent.maxTokens||5000),
            timeoutSeconds:Number(agent.timeoutSeconds||180),
            extraHeaders:agent.extraHeaders||{},
            featureModels:{controlAgent:agent.model||''},
        },
    };
}

function controlAgentConfigured(config) {
    if(config?.controlAgent?.enabled===false)return false;
    const effective=controlAgentCallConfig(config);
    const provider=String(effective?.llm?.provider||'openai-compatible').toLowerCase();
    const model=String(effective?.llm?.model||'').trim();
    if(!model)return false;
    if(provider==='anthropic'||provider==='gemini')return true;
    return Boolean(String(effective?.llm?.baseUrl||'').trim());
}

function controlAgentCapabilities(config) {
    const agent = config?.controlAgent || {};
    const provider = String(agent.provider || 'openai-compatible').toLowerCase();
    const model = String(agent.model || '').trim();
    const hint = `${provider} ${model}`;
    const likelyImage = provider === 'gemini'
        || (provider === 'anthropic' && /claude-(?:3|4)|sonnet|opus|haiku/i.test(model))
        || (provider === 'openai-compatible' && /vision|4o|4\.1|o[1-4](?:-|$)|qwen[-_ ]?vl|llava|pixtral|glm[-_ ]?4v|minicpm[-_ ]?v|internvl|gemini/i.test(model));
    const knownImage = Boolean(model) && likelyImage;
    return {
        provider,
        model,
        source: 'Gợi ý năng lực mô hình do VVV suy đoán tại chỗ (dựa trên loại giao diện và tên mô hình, không thay thế tài liệu của nhà cung cấp)',
        imageInput: {
            supported: knownImage ? true : null,
            confidence: knownImage ? 'likely' : 'unknown',
            detail: knownImage
                ? 'Giao diện/tên mô hình này thường hỗ trợ đầu vào là ảnh; vẫn phải lấy tài liệu mô hình hiện hành của nhà cung cấp và thử nghiệm thực tế làm chuẩn.'
                : 'Chưa xác nhận được năng lực thị giác từ loại giao diện và tên mô hình; có thể tải ảnh lên để thử, nếu thất bại sẽ báo lỗi rõ ràng.',
        },
        fileInput: {
            supported: 'text-inline',
            confidence: 'declared',
            detail: 'Văn bản, JSON, Markdown, mã nguồn và log sẽ được che thông tin nhạy cảm rồi gửi đi dưới dạng tóm tắt nội tuyến; tệp nhị phân không được ghi xuống đĩa hay tải thẳng lên.',
        },
        nativeFileInput: {
            supported: false,
            confidence: 'declared',
            detail: 'VVV không giao tệp tùy ý cho dịch vụ lưu trữ tệp của nhà cung cấp mô hình, nhằm tránh lưu giữ lâu dài và đọc vượt quyền.',
        },
        network: {
            supported: false,
            confidence: 'declared',
            detail: 'Quản gia hiện chỉ gọi giao diện mô hình đã cấu hình, không cấp quyền truy cập mạng qua trình duyệt, tìm kiếm hay bất kỳ công cụ ngoài nào.',
        },
        toolCalling: {
            supported: null,
            confidence: 'unknown',
            detail: 'Việc mô hình có khai báo năng lực gọi công cụ hay không tùy thuộc dịch vụ tương thích; VVV vẫn chỉ chạy các thao tác trong danh sách trắng cục bộ và luôn hỏi xác nhận.',
        },
        limits: {
            maxAttachments: CONTROL_AGENT_MAX_ATTACHMENTS,
            maxImageBytes: CONTROL_AGENT_MAX_IMAGE_BYTES,
            maxTextBytes: CONTROL_AGENT_MAX_TEXT_BYTES,
            maxTotalBytes: CONTROL_AGENT_MAX_ATTACHMENT_TOTAL_BYTES,
        },
        hint,
    };
}

async function listModels(config) {
    const provider = String(config.llm.provider || 'openai-compatible').toLowerCase();
    if (provider === 'gemini') {
        const base = normalizeBaseUrl(config.llm.baseUrl || 'https://generativelanguage.googleapis.com/v1beta');
        const url = `${base}/models${config.llm.apiKey ? `?key=${encodeURIComponent(config.llm.apiKey)}` : ''}`;
        const { data } = await fetchJson(url, { headers: headersWithExtra({}, config.llm.extraHeaders), signal: timeoutSignal(60) });
        return (data.models || []).map(item => item.name?.replace(/^models\//, '')).filter(Boolean);
    }
    if (provider === 'anthropic') {
        const base = normalizeBaseUrl(config.llm.baseUrl || 'https://api.anthropic.com/v1');
        const url = joinUrl(base, '/models');
        const { data } = await fetchJson(url, {
            headers: headersWithExtra({ 'x-api-key': config.llm.apiKey || '', 'anthropic-version': '2023-06-01' }, config.llm.extraHeaders),
            signal: timeoutSignal(60),
        });
        return (data.data || []).map(item => item.id).filter(Boolean);
    }
    const base = normalizeBaseUrl(config.llm.baseUrl);
    const url = /\/models$/i.test(base) ? base : joinUrl(base, '/models');
    const headers = headersWithExtra({}, config.llm.extraHeaders);
    if (config.llm.apiKey) headers.authorization = `Bearer ${config.llm.apiKey}`;
    const { data } = await fetchJson(url, { headers, signal: timeoutSignal(60) });
    return (data.data || data.models || []).map(item => item.id || item.name).filter(Boolean);
}

async function embedTexts(config, texts) {
    if (!config.embedding.enabled) throw new Error('Chưa bật mô hình vector');
    const provider = String(config.embedding.provider || 'openai-compatible').toLowerCase();
    if (provider === 'gemini') {
        const base = normalizeBaseUrl(config.embedding.baseUrl || 'https://generativelanguage.googleapis.com/v1beta');
        const model = config.embedding.model.startsWith('models/') ? config.embedding.model : `models/${config.embedding.model}`;
        const url = `${base}/${model}:batchEmbedContents${config.embedding.apiKey ? `?key=${encodeURIComponent(config.embedding.apiKey)}` : ''}`;
        const headers = headersWithExtra({ 'content-type': 'application/json' }, config.embedding.extraHeaders);
        const { data } = await fetchJson(url, {
            method: 'POST', headers,
            body: JSON.stringify({ requests: texts.map(text => ({ model, content: { parts: [{ text }] } })) }),
            signal: timeoutSignal(config.embedding.timeoutSeconds),
        });
        return (data.embeddings || []).map(item => item.values || []);
    }
    const base = normalizeBaseUrl(config.embedding.baseUrl);
    const url = /\/embeddings$/i.test(base) ? base : joinUrl(base, '/embeddings');
    const headers = headersWithExtra({ 'content-type': 'application/json' }, config.embedding.extraHeaders);
    if (config.embedding.apiKey) headers.authorization = `Bearer ${config.embedding.apiKey}`;
    const body = { model: config.embedding.model, input: texts };
    if (Number(config.embedding.dimensions) > 0) body.dimensions = Number(config.embedding.dimensions);
    const { data } = await fetchJson(url, {
        method: 'POST', headers, body: JSON.stringify(body), signal: timeoutSignal(config.embedding.timeoutSeconds),
    });
    return (data.data || []).sort((a, b) => Number(a.index) - Number(b.index)).map(item => item.embedding || []);
}

function tokenize(text) {
    const normalized = String(text || '').toLowerCase().replace(/[\p{P}\p{S}\s]+/gu, ' ').trim();
    // Vietnamese is written in syllables, so index single syllables plus adjacent
    // pairs; most concepts ("đơn hàng", "chuyển khoản") only exist as a pair.
    const words = normalized.match(/[\p{L}\p{N}_]+/gu) || [];
    const bigrams = [];
    for (let i = 0; i < words.length - 1; i += 1) bigrams.push(`${words[i]} ${words[i + 1]}`);
    return [...words, ...bigrams].filter(Boolean);
}

const MEMORY_QUERY_SYNONYM_GROUPS = Object.freeze([
    ['tiền về','vào tài khoản','nhận tiền','chuyển tiền','chuyển khoản','chuyển khoản thành công','đã nhận được tiền'], ['lương','tiền lương','mức lương','lương tháng','trả lương'],
    ['vẽ tranh','nhuận bút','tiền công','đặt vẽ','tiền minh họa','phí thiết kế'], ['mua','đã mua','mua đồ','đặt đơn','đơn hàng'],
    ['giao đồ ăn','đặt món','Ele.me','Meituan','ship đồ ăn'], ['điện thoại','cuộc gọi đến','cuộc gọi'], ['Khoảnh khắc','bài đăng','bảng tin bạn bè'],
    ['lời hẹn','lời hứa','đồng ý','đã hẹn'], ['tầng','tầng nào','tầng thứ mấy','lượt'], ['lần đầu','sớm nhất','đầu tiên'], ['lần cuối','lần gần nhất','lần trước'],
]);

function planMemoryQuery(query) {
    const raw=String(query||'').trim(),extra=[];
    for(const group of MEMORY_QUERY_SYNONYM_GROUPS)if(group.some(term=>raw.includes(term)))extra.push(...group);
    const temporalIntent=/lần đầu|sớm nhất|đầu tiên/i.test(raw)?'first':(/lần cuối|lần gần nhất|lần trước|gần đây/i.test(raw)?'last':(/hiện tại|bây giờ|trạng thái hiện tại/i.test(raw)?'current':''));
    return {raw,lexicalText:[raw,...new Set(extra)].join(' '),temporalIntent,timelineIntent:/dòng thời gian|khi nào|lúc nào|tầng nào|tầng thứ mấy|bao nhiêu tầng|tầng\s*\d+|lúc đó|hôm đó|đã xảy ra chuyện gì|còn nhớ|lần đầu|lần cuối|sớm nhất|lần gần nhất/i.test(raw)};
}

const VIETNAMESE_NUMERAL_DIGITS={'không':0,'linh':0,'lẻ':0,'một':1,'mốt':1,'hai':2,'ba':3,'bốn':4,'tư':4,'năm':5,'lăm':5,'nhăm':5,'sáu':6,'bảy':7,'bẩy':7,'tám':8,'chín':9};
const VIETNAMESE_NUMERAL_UNITS={'mười':10,'mươi':10,'trăm':100,'nghìn':1000,'ngàn':1000,'triệu':1000000};
function vietnameseNumeralToNumber(value) {
    const words=String(value||'').toLowerCase().replace(/[^\p{L}\s]+/gu,' ').split(/\s+/).filter(Boolean);
    if(!words.length)return NaN;
    let total=0,section=0,current=0,seen=false;
    for(const word of words){
        if(Object.hasOwn(VIETNAMESE_NUMERAL_DIGITS,word)){current=VIETNAMESE_NUMERAL_DIGITS[word];seen=true;continue;}
        const unit=VIETNAMESE_NUMERAL_UNITS[word];
        if(!unit)return NaN;
        seen=true;
        if(unit>=1000){total+=(section+(current||1))*unit;section=0;current=0;}
        else{section+=(current||1)*unit;current=0;}
    }
    const result=total+section+current;
    return seen&&Number.isFinite(result)?result:NaN;
}

function queryFloorRefs(query) {
    const value=String(query||''),refs=[];
    const addRange=(start,end)=>{if(!Number.isFinite(start)||!Number.isFinite(end))return;const low=Math.min(start,end),high=Math.max(start,end);if(high-low<=80)for(let floor=low;floor<=high;floor+=1)refs.push(floor);else refs.push(start,end);};
    // Ranges first, so "tầng 10 đến 20" is not read as two unrelated floors.
    for(const match of value.matchAll(/tầng\s*(\d{1,6})\s*(?:đến|tới|[-~—–])\s*(?:tầng\s*)?(\d{1,6})/gi))addRange(Number(match[1]),Number(match[2]));
    for(const match of value.matchAll(/tầng\s+([a-zA-ZÀ-ỹ]+(?:\s+[a-zA-ZÀ-ỹ]+){0,3}?)\s+(?:đến|tới)\s+(?:tầng\s+)?([a-zA-ZÀ-ỹ]+(?:\s+[a-zA-ZÀ-ỹ]+){0,3})/gi))addRange(vietnameseNumeralToNumber(match[1]),vietnameseNumeralToNumber(match[2]));
    for(const match of value.matchAll(/tầng\s*(\d{1,6})/gi))refs.push(Number(match[1]));
    for(const match of value.matchAll(/tầng\s+([a-zA-ZÀ-ỹ]+(?:\s+[a-zA-ZÀ-ỹ]+){0,3})/gi)){
        const words=match[1].trim().split(/\s+/);
        for(let take=words.length;take>0;take-=1){const parsed=vietnameseNumeralToNumber(words.slice(0,take).join(' '));if(Number.isFinite(parsed)){refs.push(parsed);break;}}
    }
    return [...new Set(refs.filter(Number.isFinite))];
}

function reciprocalRankScores(scores, constant = 60) {
    const output=new Array(scores.length).fill(0);
    const ranked=scores.map((score,index)=>({score:Number(score||0),index})).filter(item=>item.score>0).sort((a,b)=>b.score-a.score);
    const ceiling=1/(Math.max(1,Number(constant)||60)+1);
    ranked.forEach((item,rank)=>{output[item.index]=(1/(Math.max(1,Number(constant)||60)+rank+1))/ceiling;});
    return output;
}

function termFrequency(tokens) {
    const result = {};
    for (const token of tokens) result[token] = (result[token] || 0) + 1;
    return result;
}

function dot(a, b) {
    const len = Math.min(a?.length || 0, b?.length || 0);
    let value = 0;
    for (let i = 0; i < len; i += 1) value += Number(a[i] || 0) * Number(b[i] || 0);
    return value;
}

function cosine(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || !a.length || !b.length) return 0;
    let aa = 0; let bb = 0;
    for (const value of a) aa += Number(value || 0) ** 2;
    for (const value of b) bb += Number(value || 0) ** 2;
    return aa && bb ? dot(a, b) / Math.sqrt(aa * bb) : 0;
}

function bm25Scores(documents, queryTokens) {
    const N = documents.length || 1;
    const avgdl = documents.reduce((sum, doc) => sum + Number(doc.tokenCount || 0), 0) / N || 1;
    const df = {};
    for (const token of new Set(queryTokens)) {
        df[token] = documents.reduce((count, doc) => count + (doc.tf?.[token] ? 1 : 0), 0);
    }
    const k1 = 1.4; const b = 0.75;
    return documents.map(doc => {
        let score = 0;
        const dl = Number(doc.tokenCount || 0);
        for (const token of queryTokens) {
            const freq = Number(doc.tf?.[token] || 0);
            if (!freq) continue;
            const idf = Math.log(1 + (N - Number(df[token] || 0) + 0.5) / (Number(df[token] || 0) + 0.5));
            score += idf * ((freq * (k1 + 1)) / (freq + k1 * (1 - b + b * dl / avgdl)));
        }
        return score;
    });
}


// ---------------- R9S1P14 / 0-32 associative memory ----------------
// This is an original implementation inspired by VCP's public memory-routing ideas:
// explicit tags are treated as semantic anchors; co-occurrence builds a small graph;
// a query activates nearby tags and then re-ranks memories across different data types.
function cleanMemoryTag(value) {
    return String(value || '').trim().replace(/[\r\n\t]+/g, ' ').slice(0, 64);
}

function normalizedTags(doc) {
    return [...new Set([...(doc.tags || []), ...(doc.characters || [])].map(cleanMemoryTag).filter(Boolean))].slice(0, 48);
}

function buildAssociationGraph(documents) {
    const counts = {};
    const pairCounts = {};
    for (const doc of documents) {
        const tags = normalizedTags(doc).slice(0, 20);
        for (const tag of tags) counts[tag] = (counts[tag] || 0) + 1;
        for (let i = 0; i < tags.length; i += 1) {
            for (let j = i + 1; j < tags.length; j += 1) {
                const a = tags[i], b = tags[j];
                (pairCounts[a] ||= {})[b] = (pairCounts[a]?.[b] || 0) + 1;
                (pairCounts[b] ||= {})[a] = (pairCounts[b]?.[a] || 0) + 1;
            }
        }
    }
    const edges = {};
    for (const [tag, neighbors] of Object.entries(pairCounts)) {
        const denom = Math.max(1, Number(counts[tag] || 1));
        edges[tag] = Object.entries(neighbors)
            .map(([other, count]) => ({ tag: other, weight: Number(count) / Math.sqrt(denom * Math.max(1, Number(counts[other] || 1))) }))
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 24);
    }
    return { counts, edges };
}

function tokenSet(text) { return new Set(tokenize(text)); }

function tagQuerySimilarity(queryText, queryTokens, tag) {
    const value = String(tag || '').toLowerCase();
    if (!value) return 0;
    if (String(queryText || '').toLowerCase().includes(value)) return 1;
    const tokens = tokenSet(value);
    if (!tokens.size || !queryTokens.size) return 0;
    let overlap = 0;
    for (const token of tokens) if (queryTokens.has(token)) overlap += 1;
    const coverage = overlap / Math.max(1, Math.min(tokens.size, queryTokens.size));
    return Math.min(1, coverage);
}

function associativeSeedTags(queryText, graph, maxSeeds = 8) {
    const queryTokens = tokenSet(queryText);
    const ranked = [];
    for (const tag of Object.keys(graph?.counts || {})) {
        const score = tagQuerySimilarity(queryText, queryTokens, tag);
        if (score >= 0.20) ranked.push([tag, score]);
    }
    ranked.sort((a,b)=>b[1]-a[1]);
    const best = Number(ranked[0]?.[1] || 0);
    // Nếu truy vấn đã trúng trọn một nhãn cụ thể thì thu hẹp hạt giống lại, tránh việc “đêm mưa A” kéo theo “đêm mưa B/C/D” như thể cùng một khái niệm.
    if (best >= 0.95) return ranked.filter(([,score]) => score >= Math.max(0.82, best * 0.82)).slice(0, Math.max(1, Math.min(4, maxSeeds)));
    return ranked.slice(0, Math.max(1, Math.min(8, maxSeeds)));
}

function expandAssociativeTags(queryText, graph, maxTags = 12) {
    const topSeed = associativeSeedTags(queryText, graph, 8);
    const expanded = new Map(topSeed);
    for (const [tag, seedScore] of topSeed) {
        for (const edge of graph?.edges?.[tag] || []) {
            const score = Math.min(0.92, seedScore * Number(edge.weight || 0) * 0.95);
            if (score < 0.08) continue;
            if (score > Number(expanded.get(edge.tag) || 0)) expanded.set(edge.tag, score);
        }
    }
    return [...expanded.entries()].sort((a,b)=>b[1]-a[1]).slice(0, Math.max(2, Math.min(24, Number(maxTags) || 12)));
}

function memoryTypeIntentBoost(queryText, doc) {
    const q = String(queryText || '');
    const type = String(doc.type || '');
    let boost = 0;
    if (/lời hẹn|đồng ý|lời hứa|đã hẹn/i.test(q) && /promise/.test(type)) boost += 0.16;
    if (/bí mật|giấu|người biết|biết chuyện/i.test(q) && /secret/.test(type)) boost += 0.16;
    if (/quan hệ|thích|phải lòng|yêu đương|chia tay|thân mật/i.test(q) && /relations|episode-anchor/.test(type)) boost += 0.12;
    if (/quần áo|ăn mặc|kiểu tóc|giày|ngoại hình/i.test(q) && /appearance/.test(type)) boost += 0.14;
    if (/điện thoại|cuộc gọi đến|gọi điện/i.test(q) && /phone-calls/.test(type)) boost += 0.14;
    if (/WeChat|trò chuyện|tin nhắn/i.test(q) && /phone-wechat|phone-group/.test(type)) boost += 0.12;
    if (/Khoảnh khắc|bảng tin/i.test(q) && /story-moments/.test(type)) boost += 0.14;
    if (/nhật ký/i.test(q) && /story-diary/.test(type)) boost += 0.14;
    if (/ngày kỷ niệm|sinh nhật|kỷ niệm năm/i.test(q) && /story-anniversaries/.test(type)) boost += 0.16;
    if (/thói quen|thích ăn|thích uống|kiêng|sở thích|không ăn|dị ứng/i.test(q) && /life-fact/.test(type)) boost += 0.14;
    if (/ăn gì|mua gì|gọi món gì|oden|món ăn|hàng hóa|chuyện vặt|lúc đó/i.test(q) && /episode-fact|chat-floor|phone-order/.test(type)) boost += 0.20;
    return boost;
}

function associativeScores(doc, directMap, expandedMap) {
    const tags = normalizedTags(doc);
    if (!tags.length) return { tagScore: 0, graphScore: 0 };
    let direct = 0, graph = 0;
    for (const tag of tags) {
        direct = Math.max(direct, Number(directMap.get(tag) || 0));
        const e = Number(expandedMap.get(tag) || 0);
        graph = Math.max(graph, Math.max(0, e - Number(directMap.get(tag) || 0)));
    }
    return { tagScore: Math.min(1, direct), graphScore: Math.min(1, graph) };
}

function diversifyMemoryResults(candidates, topK) {
    const picked = [];
    const typeCount = new Map();
    const titleSeen = new Set();
    for (const item of candidates) {
        let penalty = 0;
        const type = String(item.type || '');
        const sameType = Number(typeCount.get(type) || 0);
        if (sameType >= 2 && !item.exactFloor) penalty += Math.min(0.10, 0.025 * (sameType - 1));
        const titleKey = String(item.title || '').trim().toLowerCase();
        if (titleKey && titleSeen.has(titleKey) && !item.exactFloor) penalty += 0.06;
        const reranked = { ...item, diversityPenalty: penalty, score: Number(item.score || 0) - penalty };
        if (reranked.score < 0 && !reranked.exactFloor) continue;
        picked.push(reranked);
        typeCount.set(type, sameType + 1);
        if (titleKey) titleSeen.add(titleKey);
        if (picked.length >= topK) break;
    }
    return picked.sort((a,b)=>b.score-a.score);
}

function indexFile(chatKey) {
    return path.join(INDEX_DIR(), `${safeId(chatKey)}.json`);
}

function loadIndexCached(chatKey) {
    const key = indexCacheKey(chatKey);
    const file = indexFile(chatKey);
    let stat = null;
    try { stat = fs.statSync(file); } catch {}
    const cached = indexCache.get(key);
    if (cached && stat && Number(cached.mtimeMs) === Number(stat.mtimeMs) && Number(cached.size) === Number(stat.size)) { touchIndexCache(key, cached); return cached.payload; }
    const payload = readJson(file, { documents: [], associationGraph: { counts:{}, edges:{} } });
    if (stat) touchIndexCache(key, { mtimeMs:Number(stat.mtimeMs), size:Number(stat.size), payload });
    else indexCache.delete(key);
    return payload;
}

function storeIndexCache(chatKey, payload) {
    const key = indexCacheKey(chatKey);
    try {
        const stat = fs.statSync(indexFile(chatKey));
        touchIndexCache(key, { mtimeMs:Number(stat.mtimeMs), size:Number(stat.size), payload });
    } catch { touchIndexCache(key, { mtimeMs:0, size:0, payload }); }
}

function clearIndexCache(chatKey) {
    indexCache.delete(indexCacheKey(chatKey));
}

function normalizeDocuments(documents) {
    return (Array.isArray(documents) ? documents : []).map((doc, index) => ({
        ...doc,
        id: String(doc.id || crypto.randomUUID()),
        type: String(doc.type || 'memory'),
        title: String(doc.title || ''),
        text: String(doc.text || '').slice(0, 30000),
        floorStart: Number.isFinite(Number(doc.floorStart)) ? Number(doc.floorStart) : null,
        floorEnd: Number.isFinite(Number(doc.floorEnd)) ? Number(doc.floorEnd) : null,
        time: String(doc.time || ''),
        characters: Array.isArray(doc.characters) ? [...new Set(doc.characters.map(value => String(value || '').trim()).filter(Boolean))].slice(0, 32) : [],
        tags: Array.isArray(doc.tags) ? [...new Set(doc.tags.map(value => String(value || '').trim()).filter(Boolean))].slice(0, 32) : [],
        importanceWeight: Math.max(0, Math.min(1, Number(doc.importanceWeight ?? (doc.important ? 0.9 : 0.25)))),
        important: Boolean(doc.important),
        tier: ['core','hot','cold'].includes(String(doc.tier || '')) ? String(doc.tier) : (doc.important ? 'core' : 'cold'),
        timeline: Boolean(doc.timeline),
        summaryType: String(doc.summaryType || ''),
        vectorEligible: doc.vectorEligible !== false,
        sourceHash: String(doc.sourceHash || crypto.createHash('sha256').update(String(doc.text || '')).digest('hex')),
        order: index,
    })).filter(doc => doc.text.trim());
}

async function rebuildIndex(chatKey, documents, config) {
    const normalized = normalizeDocuments(documents);
    const previous = readJson(indexFile(chatKey), { documents: [] });
    const previousByHash = new Map((previous.documents || []).map(doc => [doc.sourceHash, doc]));
    const next = normalized.map(doc => {
        const tagText = normalizedTags(doc).join(' ');
        // Nhân đôi nhãn chỉ tác động tới trọng số của chỉ mục từ vựng, không đổi văn bản ký ức gốc.
        const tokens = tokenize(`tầng ${doc.floorStart ?? ''} tầng ${doc.floorEnd ?? ''}\n${doc.title}\n${tagText}\n${tagText}\n${doc.text}`);
        const old = previousByHash.get(doc.sourceHash);
        return { ...doc, tf: termFrequency(tokens), tokenCount: tokens.length, vector: doc.vectorEligible === false ? null : (old?.vector || null) };
    });
    if (config.embedding.enabled && config.embedding.model && config.embedding.baseUrl) {
        const missing = next.filter(doc => doc.vectorEligible !== false && (!Array.isArray(doc.vector) || !doc.vector.length));
        const batchSize = 16;
        for (let i = 0; i < missing.length; i += batchSize) {
            const batch = missing.slice(i, i + batchSize);
            const vectors = await embedTexts(config, batch.map(doc => `tầng ${doc.floorStart ?? ''} tầng ${doc.floorEnd ?? ''}\n${doc.title}\n${doc.text}`.slice(0, 12000)));
            batch.forEach((doc, offset) => { doc.vector = vectors[offset] || null; });
        }
    }
    const associationGraph = buildAssociationGraph(next);
    const sourceManifest = next.map(doc => `${doc.id}:${doc.sourceHash}`).sort();
    const sourceManifestHash = crypto.createHash('sha256').update(sourceManifest.join('|')).digest('hex').slice(0,24);
    const revision = Math.max(0, Number(previous.revision || 0)) + 1;
    const generation = stableHashId('index-generation', `${chatKey}|${revision}|${sourceManifestHash}|${Date.now()}`);
    const payload = { version: VERSION, schemaVersion: 2, chatKey, revision, generation, sourceManifestHash, updatedAt: Date.now(), documents: next, associationGraph };
    writeJsonAtomic(indexFile(chatKey), payload);
    storeIndexCache(chatKey, payload);
    return {
        revision,
        generation,
        sourceManifestHash,
        count: next.length,
        vectorCount: next.filter(doc => Array.isArray(doc.vector) && doc.vector.length).length,
        coreCount: next.filter(doc => doc.tier === 'core').length,
        hotCount: next.filter(doc => doc.tier === 'hot').length,
        coldCount: next.filter(doc => doc.tier === 'cold').length,
        tagCount: Object.keys(associationGraph.counts || {}).length,
        associationEdges: Object.values(associationGraph.edges || {}).reduce((sum, list) => sum + list.length, 0),
    };
}

async function searchIndex(chatKey, query, options, config) {
    const index = loadIndexCached(chatKey);
    const documents = index.documents || [];
    if (!documents.length) return [];
    const queryText = String(query || '');
    const queryPlan = planMemoryQuery(queryText);
    const queryTokens = tokenize(queryPlan.lexicalText);
    const floorRefs = queryFloorRefs(queryText);
    const timelineIntent = queryPlan.timelineIntent;
    const lexical = bm25Scores(documents, queryTokens);
    const lexicalMax = Math.max(...lexical, 0.00001);
    let queryVector = null;
    if (config.embedding.enabled && documents.some(doc => Array.isArray(doc.vector) && doc.vector.length)) {
        try { [queryVector] = await embedTexts(config, [queryText.slice(0, 12000)]); } catch (error) {
            console.warn(`[${PLUGIN_ID}] Vector hóa truy vấn thất bại, hạ cấp về tìm kiếm theo từ khóa:`, error.message);
        }
    }

    const vectorWeight = Number(options?.vectorWeight ?? config.retrieval.vectorWeight ?? 0.6);
    const lexicalWeight = Number(options?.lexicalWeight ?? config.retrieval.lexicalWeight ?? 0.4);
    const topK = Math.max(1, Math.min(50, Number(options?.topK ?? config.retrieval.topK ?? 8)));
    const minScore = Number(options?.minScore ?? config.retrieval.minScore ?? 0.18);
    const vcpEnabled = options?.vcpEnabled !== false && config.retrieval.vcpEnabled !== false;
    const tagWeight = Math.max(0, Math.min(0.5, Number(options?.tagWeight ?? config.retrieval.tagWeight ?? 0.18)));
    const graphWeight = Math.max(0, Math.min(0.5, Number(options?.graphWeight ?? config.retrieval.graphWeight ?? 0.12)));
    const coreWeight = Math.max(0, Math.min(0.3, Number(options?.coreWeight ?? config.retrieval.coreWeight ?? 0.08)));
    const maxExpandedTags = Math.max(2, Math.min(24, Number(options?.maxExpandedTags ?? config.retrieval.maxExpandedTags ?? 12)));
    const vectorScores = documents.map(doc => queryVector && doc.vector ? Math.max(0, cosine(queryVector, doc.vector)) : 0);
    const lexicalRanks = reciprocalRankScores(lexical);
    const vectorRanks = reciprocalRankScores(vectorScores);
    const weightTotal = Math.max(0.0001, vectorWeight + lexicalWeight);
    const finiteFloors=documents.map(doc=>Number(doc.floorStart)).filter(Number.isFinite),maxFloor=Math.max(1,...finiteFloors);

    const associationGraph = index.associationGraph || buildAssociationGraph(documents);
    const expandedPairs = vcpEnabled ? expandAssociativeTags(queryText, associationGraph, maxExpandedTags) : [];
    const seedPairs = vcpEnabled ? associativeSeedTags(queryText, associationGraph, 8) : [];
    const directMap = new Map(seedPairs);
    const expandedMap = new Map(expandedPairs);
    const hasExactSeed = seedPairs.some(([,score]) => Number(score) >= 0.95);

    const candidates = documents.map((doc, index2) => {
        const vectorScore = vectorScores[index2];
        const lexicalScore = lexical[index2] / lexicalMax;
        const hasDocumentVector=Boolean(queryVector&&doc.vector);
        const normalizedMix = hasDocumentVector
            ? vectorWeight * vectorScore + lexicalWeight * lexicalScore
            : lexicalScore;
        const rrfScore = hasDocumentVector
            ? (vectorWeight * vectorRanks[index2] + lexicalWeight * lexicalRanks[index2]) / weightTotal
            : lexicalRanks[index2];
        const baseScore = 0.72 * normalizedMix + 0.28 * rrfScore;
        const exactFloor = floorRefs.some(floor => {
            const a = Number(doc.floorStart), b = Number(doc.floorEnd);
            if (Number.isFinite(a) && Number.isFinite(b)) return floor >= Math.min(a,b) && floor <= Math.max(a,b);
            return Number.isFinite(a) && floor === a;
        });
        const { tagScore, graphScore } = vcpEnabled ? associativeScores(doc, directMap, expandedMap) : { tagScore:0, graphScore:0 };
        const relevance = Math.min(1, Math.max(baseScore, tagScore, graphScore));
        const importanceScore = Math.max(0, Math.min(1, Number(doc.importanceWeight ?? (doc.important ? 0.9 : 0.25))));
        const coreGravity = vcpEnabled ? coreWeight * importanceScore * Math.max(0.18, relevance) : 0;
        const floorValue=Number(doc.floorStart);
        const temporalRankBoost=doc.type==='chat-floor'&&Number.isFinite(floorValue)
            ? (queryPlan.temporalIntent==='first'?0.08*(1-Math.min(1,floorValue/maxFloor)):(['last','current'].includes(queryPlan.temporalIntent)?0.08*Math.min(1,floorValue/maxFloor):0))
            : 0;
        const boost = (doc.important ? 0.06 : 0)
            + (doc.tier === 'hot' ? 0.025 : 0)
            + (exactFloor ? 0.72 : 0)
            + (timelineIntent && (doc.timeline || doc.type === 'timeline-event') ? 0.10 : 0)
            + (timelineIntent && doc.type === 'chat-floor' ? 0.14 : 0)
            + temporalRankBoost
            + memoryTypeIntentBoost(queryText, doc);
        const rawScore = baseScore + boost + (vcpEnabled ? tagWeight * tagScore + graphWeight * graphScore + coreGravity : 0);
        // Liên kết đồ thị mạnh có thể tự nó là lý do gợi nhớ; đồng thời khi truy vấn đã trúng chính xác một nhãn,
        // hãy hạ thấp nhiễu kiểu “trúng chỉ vì trùng vài âm tiết”, tránh để ký ức liên quan thật sự bị các mục na ná nhấn chìm.
        const graphSemanticFloor = vcpEnabled && graphScore >= 0.45 ? graphScore * 0.55 + coreGravity : 0;
        const fuzzyNoisePenalty = vcpEnabled && hasExactSeed && tagScore < 0.01 && graphScore < 0.08 ? 0.22 : 0;
        const score = Math.max(rawScore, graphSemanticFloor) - fuzzyNoisePenalty;
        return {
            ...doc,
            vector: undefined,
            tf: undefined,
            score,
            vectorScore,
            lexicalScore,
            rrfScore,
            tagScore,
            graphScore,
            importanceScore,
            exactFloor,
            expandedTags: vcpEnabled ? expandedPairs.slice(0, 8).map(([tag, weight]) => ({ tag, weight })) : [],
            provenance: {
                sourceHash: doc.sourceHash || '',
                sourceFloor: Number.isFinite(Number(doc.floorStart)) ? Number(doc.floorStart) : null,
                entityId: doc.entityId || doc.orderId || doc.transactionId || '',
                orderId: doc.orderId || '',
                eventId: doc.eventId || '',
                indexRevision: Number(index.revision || 0),
                indexGeneration: index.generation || '',
            },
        };
    }).filter(item => item.score >= minScore
        || item.exactFloor
        || (item.important && item.score >= minScore * 0.35)
        || (vcpEnabled && item.graphScore >= 0.45 && item.score >= minScore * 0.45))
      .sort((a, b) => b.score - a.score);

    return diversifyMemoryResults(candidates, topK);
}

function taskFile(id) { return path.join(TASKS_DIR(), `${safeId(id)}.json`); }

function publicTask(task, includeResult = true) {
    return {
        id: task.id,
        account: task.account,
        type: task.type,
        status: task.status,
        progress: task.progress,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        chatKey: task.chatKey,
        feature: task.feature,
        model: task.model,
        provider: task.provider,
        usage: task.usage,
        error: task.error,
        errorName: task.errorName || '',
        errorCode: task.errorCode || '',
        policyRefusal: Boolean(task.policyRefusal),
        promptPipeline: task.promptPipeline || null,
        result: includeResult ? task.result : undefined,
    };
}

function persistTask(task) { writeJsonAtomic(taskFile(task.id), publicTask(task, true)); }

function loadTasks() {
    ensureDirs();
    for (const file of fs.readdirSync(TASKS_DIR())) {
        if (!file.endsWith('.json')) continue;
        const saved = readJson(path.join(TASKS_DIR(), file), null);
        if (!saved?.id) continue;
        if (['queued', 'running'].includes(saved.status)) {
            saved.status = 'error';
            saved.error = 'Tác vụ bị gián đoạn do SillyTavern khởi động lại, hãy thử lại thủ công';
            saved.updatedAt = Date.now();
            writeJsonAtomic(path.join(TASKS_DIR(), file), saved);
        }
        saved.account = saved.account || activeAccount();
        tasks.set(saved.id, saved);
    }
}

async function runTask(task, payload) {
    if (task.cancelled) return;
    task.status = 'running'; task.progress = 10; task.updatedAt = Date.now(); persistTask(task);
    try {
        const config = loadConfig();
        if (task.type === 'llm') {
            const isCompanion = String(payload?.feature || '') === 'companion';
            const isControlAgent = String(payload?.feature || '') === 'controlAgent';
            if (isCompanion && !companionConfigured(config)) throw new Error('API riêng của Bảy điều hậu trường chưa được cấu hình');
            if (isControlAgent && !controlAgentConfigured(config)) throw new Error('API riêng của Quản gia AI toàn cục chưa được cấu hình');
            const baseConfig=isControlAgent ? controlAgentCallConfig(config) : (isCompanion ? companionCallConfig(config) : config);
            const requestedTimeout=Number(payload?.timeoutSeconds);
            const configuredTimeout=Math.max(5,Number(baseConfig?.llm?.timeoutSeconds||180));
            const effective=cloneConfigWithLlm(baseConfig,{
                maxTokens:Number.isFinite(Number(payload?.maxTokens))?Math.max(256,Math.min(100000,Number(payload.maxTokens))):undefined,
                timeoutSeconds:Number.isFinite(requestedTimeout)?Math.max(5,Math.min(configuredTimeout,requestedTimeout)):undefined,
            });
            const result = await callLlm(effective, payload);
            if (task.cancelled) throw new Error('__VVV_TASK_CANCELLED__');
            task.result = { text: result.text };
            task.model = result.model; task.provider = result.provider; task.usage = result.usage;
            task.promptPipeline = payload?.promptPipeline || null;
        } else if (task.type === 'rebuild-index') {
            task.progress = 20; persistTask(task);
            const result = await rebuildIndex(task.chatKey, payload.documents, config);
            if (task.cancelled) throw new Error('__VVV_TASK_CANCELLED__');
            task.result = result;
        } else if (task.type === 'search-index') {
            const result = await searchIndex(task.chatKey, payload.query, payload.options, config);
            if (task.cancelled) throw new Error('__VVV_TASK_CANCELLED__');
            task.result = result;
        } else {
            throw new Error(`Loại tác vụ không xác định: ${task.type}`);
        }
        task.status = 'completed'; task.progress = 100; task.error = null;
        task.errorName='';task.errorCode='';task.policyRefusal=false;
    } catch (error) {
        if (task.cancelled || String(error?.message || error) === '__VVV_TASK_CANCELLED__') {
            task.status = 'cancelled'; task.progress = 100; task.error = 'Tác vụ đã bị hủy'; task.result = null;
        } else {
            const detail=publicGenerationError(error);
            task.status = 'error'; task.progress = 100; task.error = detail.message;
            task.errorName=detail.name;task.errorCode=detail.code;task.policyRefusal=detail.policyRefusal;
        }
    }
    task.updatedAt = Date.now(); persistTask(task);
}

function createTask(type, payload = {}) {
    const task = {
        id: crypto.randomUUID(), account: activeAccount(), type, status: 'queued', progress: 0,
        createdAt: Date.now(), updatedAt: Date.now(), chatKey: String(payload.chatKey || ''), dedupeKey:String(payload.dedupeKey||''),
        feature: String(payload.feature || ''), model: '', provider: '', usage: null, error: null,
        errorName:'',errorCode:'',policyRefusal:false,promptPipeline:payload?.promptPipeline||null,
        result: null, cancelled: false,
    };
    tasks.set(task.id, task); persistTask(task);
    setImmediate(() => runTask(task, payload));
    return task;
}

function cleanup() {
    for (const account of bootstrapAccounts()) accountStorage.run(account, () => { cleanupStateUploads(); cleanupCardArchiveUploads(); });
    const cutoff = Date.now() - MAX_TASK_AGE;
    for (const [id, task] of tasks) {
        if (Number(task.updatedAt || 0) < cutoff) {
            tasks.delete(id);
            try { accountStorage.run(task.account || DEFAULT_ACCOUNT, () => fs.unlinkSync(taskFile(id))); } catch {}
        }
    }
}


function cloneConfigWithLlm(config, { maxTokens, temperature, timeoutSeconds } = {}) {
    const next = JSON.parse(JSON.stringify(config || {}));
    if (Number.isFinite(Number(maxTokens))) next.llm.maxTokens = Number(maxTokens);
    if (Number.isFinite(Number(temperature))) next.llm.temperature = Number(temperature);
    if (Number.isFinite(Number(timeoutSeconds))) next.llm.timeoutSeconds = Number(timeoutSeconds);
    return next;
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms) || 0))); }

async function reservePipelineBudget(count, limit = 10, windowMs = 60_000) {
    const key = activeAccount();
    const wanted = Math.max(1, Math.min(4, Number(count || 1)));
    const cap = Math.max(wanted, Math.min(60, Number(limit || 10)));
    while (true) {
        const now = Date.now();
        const live = (pipelineReservations.get(key) || []).filter(ts => now - ts < windowMs);
        if (live.length + wanted <= cap) {
            // Đặt trước 4 suất yêu cầu cùng lúc, tránh việc hai tác vụ bốn tầng đan xen nhau làm trạm công cộng trả về 429.
            for (let i = 0; i < wanted; i += 1) live.push(now);
            pipelineReservations.set(key, live);
            return;
        }
        const oldest = Math.min(...live);
        const waitMs = Math.max(250, windowMs - (now - oldest) + 80);
        await sleep(waitMs);
    }
}

async function measuredStage(config, name, prompt, systemPrompt, { maxTokens = 1200, temperature = 0.2 } = {}) {
    const started = Date.now();
    const result = await callLlm(cloneConfigWithLlm(config, { maxTokens, temperature }), {
        prompt,
        systemPrompt,
        feature: 'relay',
        jsonMode: false,
    });
    return { name, text:String(result.text || '').trim(), model:result.model, provider:result.provider, ms:Date.now() - started, usage:result.usage || null };
}

async function runRelayPipeline4(config, { prompt, systemPrompt = '', testMode = false } = {}) {
    if (!relayConfigured(config)) throw new Error('Flash bốn tầng cần cấu hình API riêng của Tiếp sức AI trước (Base URL + mô hình)');
    const relayConfig = relayCallConfig(config);
    const limit = Number(config?.relayPipeline?.rateLimitPerMinute || 10);
    await reservePipelineBudget(4, limit);
    const source = String(prompt || '').slice(0, 180_000);
    const baseSystem = String(systemPrompt || '').slice(0, 12_000);

    const s1 = await measuredStage(relayConfig, 'Đạo diễn', `${source}\n\n【NHIỆM VỤ GIAI ĐOẠN 1】\nBạn là Đạo diễn cốt truyện của 0-32. Đừng viết chính văn cuối cùng cho user. Chỉ đưa ra bản kế hoạch đạo diễn không quá 700 chữ: giai đoạn hiện tại của mạch truyện, quán tính cảm xúc của nhân vật, những sự thật đã rồi tuyệt đối không được lặp lại, nhịp nhỏ kế tiếp tự nhiên nhất, khúc ngoặt lớn nên hoãn lại, và các điểm gài có thể dùng. Sổ cái quy tắc và chính văn AI mới nhất được ưu tiên hơn ký ức cũ. Đặc biệt phải đọc trước phần【SỰ THẬT CỨNG CỦA HIỆN THỰC HIỆN TẠI】trong prompt: những trạng thái đã hoàn tất như đã rời phòng tắm, đã ra ghế sofa, đã đeo bao đều tuyệt đối không được làm lại.`, `${baseSystem}\nBạn chỉ lập kế hoạch đạo diễn cốt truyện, không viết chính văn.`, { maxTokens:testMode?300:1100, temperature:.18 });

    const s2 = await measuredStage(relayConfig, 'Điều phối', `${source}\n\n【KẾ HOẠCH ĐẠO DIỄN】\n${s1.text}\n\n【NHIỆM VỤ GIAI ĐOẠN 2】\nBạn là người điều phối cốt truyện và kiểm tra tính liền mạch. Đừng viết chính văn cuối cùng cho user. Hãy soát xem kế hoạch đạo diễn có mâu thuẫn với hiện thực hiện tại, ký ức dài hạn, quan hệ nhân vật, lời hẹn, bí mật, thẻ định mệnh, thời gian - địa điểm và ranh giới chủ thể của user hay không. Phần【SỰ THẬT CỨNG CỦA HIỆN THỰC HIỆN TẠI】trong prompt là sự thật không thể lật ngược; mọi ý định rời phòng tắm lại, ra ghế sofa lại, lấy bao/bóc bao/đeo bao lại đều phải đưa vào mục “bắt buộc cấm”. Xuất ra danh sách “bắt buộc giữ / bắt buộc cấm / được phép đẩy tới” không quá 700 chữ.`, `${baseSystem}\nBạn chỉ làm việc điều phối cốt truyện ở tầm vĩ mô, soát ký ức và tính liền mạch.`, { maxTokens:testMode?300:1100, temperature:.12 });

    const s3 = await measuredStage(relayConfig, 'Bản nháp', `${source}\n\n【KẾ HOẠCH ĐẠO DIỄN】\n${s1.text}\n\n【BẢN SOÁT ĐIỀU PHỐI】\n${s2.text}\n\n【NHIỆM VỤ GIAI ĐOẠN 3】\nDựa đúng vào những phần trên, hãy viết một bản chính văn của user có thể gửi đi ngay. Trước khi viết, đối chiếu từng dòng của【SỰ THẬT CỨNG CỦA HIỆN THỰC HIỆN TẠI】trong prompt; không được thực hiện lại bất kỳ hành động nào đã hoàn tất trong đó. Chỉ user mới được sinh ra hành động chủ động, lời thoại, quyết định và cảm nhận mới. Được phép mô tả khách quan trạng thái tĩnh sẵn có của char/NPC (trang phục, vị trí, còn ướt, ngoại hình), nhưng char/NPC không được sinh ra hành động mới, thay đổi biểu cảm, lời thoại, phản hồi, đồng ý, từ chối, tiến lại, né tránh hay phản ứng cơ thể chủ động. Viết tới chỗ cần NPC đáp lời thì dừng bút ngay. Chỉ viết đúng nhịp nhỏ kế tiếp của cảnh hiện tại, 300-800 chữ, kể thẳng tuyệt đối, không ẩn dụ, không phân tích.`, `${baseSystem}\nBạn là người viết bản nháp chính văn cho user, chỉ xuất ra chính văn.`, { maxTokens:testMode?350:1800, temperature:.30 });

    const s4 = await measuredStage(relayConfig, 'Duyệt cuối', `${source}\n\n【KẾ HOẠCH ĐẠO DIỄN】\n${s1.text}\n\n【BẢN SOÁT ĐIỀU PHỐI】\n${s2.text}\n\n【BẢN NHÁP CHỜ DUYỆT CUỐI】\n${s3.text}\n\n【NHIỆM VỤ GIAI ĐOẠN 4｜MÁY LỌC BẢN THẢO BẮT BUỘC】\nBạn không viết tiếp tiểu thuyết, mà lọc bản nháp thành tin nhắn cuối “chỉ có thể do user gửi đi”. Bắt buộc viết lại và chỉ xuất ra chính văn cuối cùng của user:\n1. Xóa hoặc viết lại mọi hành động mới, lời thoại mới, phản hồi mới, thay đổi biểu cảm mới, đồng ý/từ chối, tiến lại/né tránh, gật/lắc đầu và phản ứng cơ thể chủ động của char/NPC; tuyệt đối không diễn thay NPC.\n2. Được giữ lại trạng thái tĩnh đã có và nhìn thấy được của NPC, ví dụ “tóc cô ấy vẫn còn ướt / người cô ấy vẫn quấn khăn tắm”.\n3. Sửa hết các lỗi: mạch truyện đi lùi, lặp lại hành động đã xong, nhảy thời gian/địa điểm, OOC, xung đột ký ức, ẩn dụ/nhân hóa/hình ảnh văn vẻ. Đặc biệt tuân thủ nghiêm【SỰ THẬT CỨNG CỦA HIỆN THỰC HIỆN TẠI】trong prompt: nếu đã ở ghế sofa thì không được viết bước ra khỏi phòng tắm / đi tới ghế sofa nữa; nếu đã đeo bao thì không được viết lấy bao/bóc vỏ/đeo bao nữa.\n4. Chủ thể của mọi “hành vi mới” bắt buộc phải là user; viết tới chỗ cần NPC đáp lời thì dừng bút ngay.\n5. Nếu bản nháp có phản hồi của NPC, đừng đổi sang một phản hồi khác, hãy xóa thẳng đoạn đó và giữ lại hành động/lời thoại của chính user.\n300-800 chữ. Không giải thích, không phân tích, không tiêu đề.`, `${baseSystem}\nĐây là bước cuối của quy trình suy diễn bốn tầng: bạn là máy lọc bản thảo bắt buộc, không phải người viết tiếp cho NPC. Chỉ xuất ra chính văn cuối cùng có thể gửi đi của user; trạng thái tĩnh của NPC thì được mô tả, nhưng NPC không được sinh ra bất kỳ hành vi mới nào.`, { maxTokens:testMode?350:1800, temperature:.08 });

    return {
        text: s4.text,
        debug: {
            calls: 4,
            rateLimitPerMinute: limit,
            stages: [s1,s2,s3,s4].map(({name,ms,model,provider,usage}) => ({name,ms,model,provider,usage})),
            director: s1.text.slice(0, 3000),
            orchestrator: s2.text.slice(0, 3000),
            draft: s3.text.slice(0, 4000),
        },
    };
}


function phoneRecoveryFingerprint(item, groupName='') {
    const attachments=(Array.isArray(item?.attachments)?item.attachments:[]).map(att=>`${String(att?.kind||'').slice(0,40)}:${String(att?.description||'').slice(0,300)}`).join('|');
    return [String(groupName||''),String(item?.role||''),String(item?.sender||item?.author||item?.contact||''),String(item?.content||''),String(item?.time||''),attachments,String(item?.pendingId||'')].join('||');
}

function collectPhoneRecoverySources({characterKey='',archiveId='',chatKey=''}={}) {
    const sources=[];
    const add=(state,createdAt=0,label='')=>{if(state&&typeof state==='object'&&state.phone&&typeof state.phone==='object')sources.push({state,createdAt:Number(createdAt||0),label:String(label||'')});};
    if(characterKey&&archiveId){
        const current=readCardArchive(characterKey,archiveId);
        if(current?.state)add(current.state,current.manifest?.updatedAt||Date.now(),'card-current');
        const hdir=cardArchiveHistoryDir(characterKey,archiveId);
        try{
            for(const name of fs.readdirSync(hdir).filter(n=>n.endsWith('.json'))){
                const row=readJson(path.join(hdir,name),null);
                if(row?.state)add(row.state,row.createdAt||Number(name.replace(/\.json$/,''))||0,`card-history:${name}`);
            }
        }catch{}
    }
    if(chatKey){
        for(const item of stateSnapshotList(chatKey).slice(0,RECOVERY_SCAN_MAX)){
            const row=readJson(item.file,null);
            if(row?.state)add(row.state,row.createdAt||item.mtimeMs||0,`state:${item.id}`);
        }
    }
    return sources.sort((a,b)=>a.createdAt-b.createdAt);
}

function phoneChronologyLooseFingerprint(item, threadName='', scope='direct') {
    const attachments=(Array.isArray(item?.attachments)?item.attachments:[]).map(att=>`${String(att?.kind||'').slice(0,40)}:${String(att?.description||'').slice(0,300)}`).join('|');
    return [String(scope||''),String(threadName||''),String(item?.sender||item?.author||item?.contact||''),String(item?.content||item?.text||item?.message||''),String(item?.time||''),attachments].join('||');
}

function collectExternalPhoneChronologySources({characterKey='',archiveId=''}={}) {
    const sources=[];
    const add=(state,createdAt=0,label='')=>{if(state&&typeof state==='object'&&state.phone&&typeof state.phone==='object')sources.push({state,createdAt:Number(createdAt||0),label:String(label||'')});};
    const parent=path.dirname(path.dirname(DATA_ROOT));
    let safeDirs=[];
    try{safeDirs=fs.readdirSync(parent,{withFileTypes:true}).filter(d=>d.isDirectory()&&/^VVV_/i.test(d.name)&&/SAFE/i.test(d.name)).map(d=>path.join(parent,d.name));}catch{}
    // Việc định vị chính xác của U1.4 là một lần quét chỉ đọc do người dùng tự kích hoạt: không tùy tiện cắt bỏ các thư mục SAFE cũ. Bản sao lưu S9.2 cũ thường chính là bằng chứng quý nhất về thứ tự gốc.
    safeDirs=safeDirs.sort((a,b)=>{try{return fs.statSync(a).mtimeMs-fs.statSync(b).mtimeMs}catch{return String(a).localeCompare(String(b))}});
    for(const safe of safeDirs){
        const archiveRoot=path.join(safe,'vvv-theater-memory','card-archives',String(characterKey||''));
        let archiveDirs=[];try{archiveDirs=fs.readdirSync(archiveRoot,{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>d.name);}catch{continue;}
        // Ưu tiên cùng archiveId, nhưng vẫn đọc các archive khác của cùng nhân vật: bản cũ hoặc lần nhập dữ liệu có thể đã dựng lại archiveId của chat.
        archiveDirs.sort((a,b)=>(a===archiveId?-1:b===archiveId?1:0));
        for(const aid of archiveDirs){
            const base=path.join(archiveRoot,aid);
            const state=readJson(path.join(base,'state.json'),null);
            let statAt=0;try{statAt=fs.statSync(path.join(base,'state.json')).mtimeMs;}catch{}
            if(state)add(state,statAt,`external-safe:${path.basename(safe)}:${aid}:state`);
            const hdir=path.join(base,'history');
            try{
                for(const name of fs.readdirSync(hdir).filter(n=>n.endsWith('.json'))){
                    const row=readJson(path.join(hdir,name),null);if(row?.state)add(row.state,row.createdAt||Number(name.replace(/\.json$/,''))||0,`external-safe:${path.basename(safe)}:${aid}:history:${name}`);
                }
            }catch{}
        }
    }
    return sources;
}

function buildPhoneChronologyEvidence(args={}) {
    const sources=[...collectPhoneRecoverySources(args),...collectExternalPhoneChronologySources(args)].sort((a,b)=>a.createdAt-b.createdAt);
    const best=new Map();
    const add=(item,{scope='direct',threadName='',channel='',source,ordinal=0}={})=>{
        if(!item||typeof item!=='object')return;
        const fp=phoneChronologyLooseFingerprint(item,threadName,scope);
        if(!fp.replaceAll('|','').trim())return;
        const row={
            scope,threadName:String(threadName||''),channel:String(channel||''),fingerprint:fp,
            id:String(item.id||''),pendingId:String(item.pendingId||''),sidecarId:String(item._sidecarId||''),
            sender:String(item.sender||item.author||item.contact||''),content:String(item.content||item.text||item.message||''),time:String(item.time||''),
            floor:Number.isFinite(Number(item._floor))?Number(item._floor):null,
            anchorFloor:Number.isFinite(Number(item._anchorFloor))?Number(item._anchorFloor):null,
            createdAt:Number.isFinite(Number(item.createdAt))?Number(item.createdAt):null,
            eventSeq:Number.isFinite(Number(item._eventSeq))?Number(item._eventSeq):null,
            sourceCreatedAt:Number(source?.createdAt||0),sourceLabel:String(source?.label||''),sourcePriority:['wechatGroups','channelGroups'].includes(String(channel||''))?0:1,sourceOrdinal:Number(ordinal||0),
        };
        const old=best.get(fp);
        if(!old || row.sourceCreatedAt<old.sourceCreatedAt || (row.sourceCreatedAt===old.sourceCreatedAt&&(row.sourcePriority<old.sourcePriority || (row.sourcePriority===old.sourcePriority&&row.sourceOrdinal<old.sourceOrdinal)))){
            best.set(fp,row);
            return;
        }
        // Giữ thứ tự xuất hiện sớm nhất, nhưng bù thêm siêu dữ liệu gốc tốt hơn lấy từ các bản sao về sau.
        for(const k of ['floor','anchorFloor','createdAt','eventSeq'])if(old[k]==null&&row[k]!=null)old[k]=row[k];
        for(const k of ['id','pendingId','sidecarId'])if(!old[k]&&row[k])old[k]=row[k];
    };
    for(const source of sources){
        const phone=source.state?.phone||{};
        // Đọc luồng thật trước: nếu ảnh chụp lịch sử còn giữ thứ tự chat gốc thì đây là bằng chứng giá trị nhất.
        for(const thread of phone.threads||[]){
            const name=String(thread?.contact||'').trim();if(!name)continue;
            (thread.messages||[]).forEach((m,i)=>add(m,{scope:'direct',threadName:name,channel:'threads',source,ordinal:i}));
        }
        for(const thread of phone.groupThreads||[]){
            const name=String(thread?.groupName||'').trim();if(!name)continue;
            (thread.messages||[]).forEach((m,i)=>add(m,{scope:'group',threadName:name,channel:'groupThreads',source,ordinal:i}));
        }
        // Sau đó đọc sổ cái phẳng. Ở vài giai đoạn lỗi của S9.x luồng đã hỏng, nhưng wechatGroups dạng phẳng vẫn giữ đúng thứ tự trước sau.
        (phone.wechatGroups||[]).forEach((m,i)=>{const name=String(m?.groupName||'').trim();if(name)add(m,{scope:'group',threadName:name,channel:'wechatGroups',source,ordinal:i});});
        (phone.channelGroups||[]).forEach((m,i)=>{const name=String(m?.groupName||'').trim();if(name)add(m,{scope:'group',threadName:name,channel:'channelGroups',source,ordinal:i});});
        (phone.wechat||[]).forEach((m,i)=>{
            const a=String(m?.author||'').trim(),c=String(m?.contact||'').trim();
            const name=String(m?.threadName||m?.peer||c||a||'').trim();if(name)add(m,{scope:'direct-ledger',threadName:name,channel:'wechat',source,ordinal:i});
        });
        (phone.sms||[]).forEach((m,i)=>{
            const a=String(m?.author||'').trim(),c=String(m?.contact||'').trim();
            const name=String(m?.threadName||m?.peer||c||a||'').trim();if(name)add(m,{scope:'direct-ledger',threadName:name,channel:'sms',source,ordinal:i});
        });
    }
    const evidence=[...best.values()].sort((a,b)=>a.sourceCreatedAt-b.sourceCreatedAt||a.sourceOrdinal-b.sourceOrdinal);
    return {evidence,sourceCount:sources.length,evidenceCount:evidence.length,scanMax:RECOVERY_SCAN_MAX};
}

function buildPhoneHistoryRecoveryBundle(args={}) {
    const sources=collectPhoneRecoverySources(args);
    const out={contacts:[],contactProfiles:[],groupProfiles:[],wechat:[],wechatGroups:[],channelGroups:[],sms:[],calls:[],threads:[],groupThreads:[]};
    const seen={};
    for(const key of ['wechat','wechatGroups','channelGroups','sms','calls'])seen[key]=new Set();
    const contactSeen=new Set(), contactProfileSeen=new Set(), groupProfileSeen=new Set();
    const directThreads=new Map(), groupThreads=new Map();
    let latestAt=0;
    for(const src of sources){
        latestAt=Math.max(latestAt,Number(src.createdAt||0));
        const phone=src.state?.phone||{};
        for(const c of phone.contacts||[]){const name=String(typeof c==='string'?c:c?.name||'').trim();if(name&&!contactSeen.has(name)){contactSeen.add(name);out.contacts.push(c);}}
        for(const c of phone.contactProfiles||[]){const name=String(c?.name||'').trim();const key=`${name}|${String(c?.homeWorldKey||'')}|${String(c?.scope||'')}`;if(name&&!contactProfileSeen.has(key)){contactProfileSeen.add(key);out.contactProfiles.push(c);}}
        for(const g of phone.groupProfiles||[]){const name=String(g?.groupName||'').trim();const key=`${name}|${String(g?.homeWorldKey||'')}|${String(g?.scope||'')}`;if(name&&!groupProfileSeen.has(key)){groupProfileSeen.add(key);out.groupProfiles.push(g);}}
        for(const key of ['wechat','wechatGroups','channelGroups','sms','calls']){
            for(const row of phone[key]||[]){
                const group=(key==='wechatGroups'||key==='channelGroups')?String(row?.groupName||''):'';
                const fp=(row?.id?`id:${row.id}`:row?.pendingId?`pending:${row.pendingId}`:phoneRecoveryFingerprint(row,group));
                if(seen[key].has(fp))continue;seen[key].add(fp);out[key].push(row);
            }
        }
        for(const t of phone.threads||[]){
            const contact=String(t?.contact||'').trim();if(!contact)continue;
            let dst=directThreads.get(contact);if(!dst){dst={...t,messages:[]};directThreads.set(contact,dst);}
            const msgSeen=new Set(dst.messages.map(m=>m?.id?`id:${m.id}`:m?.pendingId?`pending:${m.pendingId}`:phoneRecoveryFingerprint(m,'')));
            for(const m of t.messages||[]){const fp=m?.id?`id:${m.id}`:m?.pendingId?`pending:${m.pendingId}`:phoneRecoveryFingerprint(m,'');if(!msgSeen.has(fp)){msgSeen.add(fp);dst.messages.push(m);}}
            dst.updatedAt=Math.max(Number(dst.updatedAt||0),Number(t?.updatedAt||0));
        }
        for(const t of phone.groupThreads||[]){
            const groupName=String(t?.groupName||'').trim();if(!groupName)continue;
            const k=`${groupName}|${String(t?.homeWorldKey||'')}`;
            let dst=groupThreads.get(k);if(!dst){dst={...t,messages:[],members:[...(t?.members||[])]};groupThreads.set(k,dst);}
            dst.members=[...new Set([...(dst.members||[]),...(t?.members||[])].map(String).filter(Boolean))].slice(0,120);
            const msgSeen=new Set(dst.messages.map(m=>m?.id?`id:${m.id}`:m?.pendingId?`pending:${m.pendingId}`:phoneRecoveryFingerprint(m,groupName)));
            for(const m of t.messages||[]){const fp=m?.id?`id:${m.id}`:m?.pendingId?`pending:${m.pendingId}`:phoneRecoveryFingerprint(m,groupName);if(!msgSeen.has(fp)){msgSeen.add(fp);dst.messages.push(m);}}
            dst.updatedAt=Math.max(Number(dst.updatedAt||0),Number(t?.updatedAt||0));
        }
    }
    out.threads=[...directThreads.values()];out.groupThreads=[...groupThreads.values()];
    const messageCount=out.wechat.length+out.wechatGroups.length+out.channelGroups.length+out.sms.length+out.calls.length+out.threads.reduce((n,t)=>n+(t.messages?.length||0),0)+out.groupThreads.reduce((n,t)=>n+(t.messages?.length||0),0);
    return {phone:out,sourceCount:sources.length,latestAt,messageCount};
}

export async function init(router) {
    // Giai đoạn khởi tạo tuyệt đối không truy cập mạng, không chờ mô hình và không quét kho Git; tránh làm nghẽn quá trình khởi động SillyTavern 1.18.0.
    try {
        for (const account of bootstrapAccounts()) accountStorage.run(account, () => {
            ensureDirs();
            const stored = readJson(CONFIG_FILE(), null);
            // Lần đầu chạy bản hai API riêng thì dọn bể đa nguồn cũ, bù đủ cấu hình Bảy điều hậu trường, và tách hẳn phần tiếp sức ra khỏi API tổng kết.
            if (!stored || Object.hasOwn(stored,'apiPool') || !Object.hasOwn(stored,'companion') || !Object.hasOwn(stored,'phone') || !Object.hasOwn(stored,'controlAgent') || stored?.llm?.contextMode !== 'scoped' || stored?.llm?.fallbackToPreset !== false || Number(stored?.llm?.sourcePolicyRevision || 0) < 6 || stored?.relay?.useMemoryApi !== false || stored?.relay?.fallbackToPreset !== false || Number(stored?.relay?.sourcePolicyRevision || 0) < 4 || stored?.companion?.mode !== 'independent' || stored?.companion?.fallbackToPreset !== false || Number(stored?.companion?.sourcePolicyRevision || 0) < 4 || stored?.phone?.mode !== 'realtime-independent' || stored?.controlAgent?.mode !== 'confirmed-actions') writeJsonAtomic(CONFIG_FILE(), loadConfig());
        });
    } catch (error) {
        console.error(`[${PLUGIN_ID}] Khởi tạo thư mục dữ liệu thất bại, tiện ích sẽ nạp ở chế độ sự cố chỉ đọc:`, error);
    }
    // R9S1P1: khôi phục đồng bộ các tác vụ trên đĩa trước rồi mới mở route, loại bỏ tình trạng tranh chấp “tác vụ mới ngay sau khi khởi động lại bị loadTasks chậm hiểu nhầm thành tác vụ cũ bị gián đoạn”.
    try { for (const account of bootstrapAccounts()) accountStorage.run(account, loadTasks); }
    catch (error) { console.error(`[${PLUGIN_ID}] Nạp các tác vụ lịch sử thất bại:`, error); }
    cleanupTimer = setInterval(cleanup, 6 * 60 * 60 * 1000);
    cleanupTimer.unref?.();
    router.use(requireEnabledAccount);

    router.get('/health', (req, res) => {
        const config = loadConfig();
        res.json({
            ok: true, version: VERSION, account: getAccountHandle(req) || DEFAULT_ACCOUNT,
            enabledAccounts: ACCOUNT_ALLOWLIST.size ? [...ACCOUNT_ALLOWLIST] : 'all',
            llmConfigured: Boolean(config.llm.baseUrl && config.llm.model),
            memoryContextMode: 'scoped',
            memoryFallbackSource: '',
            companionSource: 'companion-independent-api',
            companionFallbackSource: '',
            companionConfigured: companionConfigured(config),
            companionIndependentConfigured: companionConfigured(config),
            phoneSource: 'phone-realtime-independent-api',
            phoneConfigured: phoneConfigured(config),
            controlAgentSource: 'confirmed-actions-independent-api',
            controlAgentConfigured: controlAgentConfigured(config),
            imageSource: 'novelai-character-reference-workflow',
            imageConfigured: Boolean(config.image?.enabled && config.image?.apiKey && config.image?.model),
            relayConfigured: relayConfigured(config),
            relayFallbackSource: '',
            relayUsesMemoryApi: false,
            embeddingConfigured: Boolean(config.embedding.enabled && config.embedding.baseUrl && config.embedding.model),
            taskCount: [...tasks.values()].filter(task => task.account === activeAccount()).length,
        });
    });

    router.get('/hub/characters', (req, res) => {
        try { res.json({ok:true,version:VERSION,archives:hubArchiveRows()}); }
        catch(error){ res.status(500).json({ok:false,error:String(error?.message||error)}); }
    });

    router.get('/hub/archive', (req, res) => {
        try {
            const characterKey=String(req.query?.characterKey||'');
            const archiveId=String(req.query?.archiveId||'');
            if(!characterKey||!archiveId)return res.status(400).json({ok:false,error:'characterKey-and-archiveId-required'});
            const archive=readCardArchive(characterKey,archiveId);
            if(!archive)return res.status(404).json({ok:false,error:'archive-not-found'});
            res.json({ok:true,manifest:archive.manifest,view:hubStateView(archive.state||{})});
        } catch(error){ res.status(400).json({ok:false,error:String(error?.message||error)}); }
    });

    router.get('/hub/search', (req, res) => {
        try {
            const characterKey=String(req.query?.characterKey||'');
            const archiveId=String(req.query?.archiveId||'');
            const q=String(req.query?.q||'');
            if(!characterKey||!archiveId)return res.status(400).json({ok:false,error:'characterKey-and-archiveId-required'});
            const archive=readCardArchive(characterKey,archiveId);
            if(!archive)return res.status(404).json({ok:false,error:'archive-not-found'});
            const view=hubStateView(archive.state||{});
            res.json({ok:true,q,results:hubKeywordSearch(view,q,req.query?.limit)});
        } catch(error){ res.status(400).json({ok:false,error:String(error?.message||error)}); }
    });


    router.delete('/hub/item', (req, res) => {
        try {
            const characterKey=String(req.body?.characterKey||'');
            const archiveId=String(req.body?.archiveId||'');
            const pathKey=String(req.body?.path||'');
            const itemKey=String(req.body?.itemKey||((req.body?.item&&hubDeletePathAllowed(pathKey))?hubDeleteItemKey(pathKey,req.body.item):''));
            if(!itemKey)return res.status(400).json({ok:false,error:'itemKey-required'});
            const result=hubDeleteMemoryItem({characterKey,archiveId,pathKey,itemKey});
            res.json({ok:true,...result});
        } catch(error){ res.status(400).json({ok:false,error:String(error?.message||error)}); }
    });

    router.delete('/hub/archive', (req, res) => {
        try {
            const characterKey=String(req.body?.characterKey||'');
            const archiveId=String(req.body?.archiveId||'');
            const result=hubTrashArchive({characterKey,archiveId});
            res.json({ok:true,...result});
        } catch(error){ res.status(400).json({ok:false,error:String(error?.message||error)}); }
    });

    router.post('/hub/archive/bulk-delete', (req, res) => {
        try {
            const raw=Array.isArray(req.body?.archives)?req.body.archives:[];
            if(!raw.length)return res.status(400).json({ok:false,error:'archives-required'});
            if(raw.length>200)return res.status(400).json({ok:false,error:'too-many-archives-max-200'});
            const seen=new Set(),deleted=[],errors=[];
            for(const item of raw){
                const characterKey=String(item?.characterKey||'');
                const archiveId=String(item?.archiveId||'');
                const key=`${characterKey}\u0000${archiveId}`;
                if(!characterKey||!archiveId||seen.has(key))continue;
                seen.add(key);
                try{
                    const result=hubTrashArchive({characterKey,archiveId});
                    deleted.push({characterKey,archiveId,...result});
                }catch(error){errors.push({characterKey,archiveId,error:String(error?.message||error)});}
            }
            res.json({ok:true,requested:raw.length,deleted,errors});
        } catch(error){ res.status(400).json({ok:false,error:String(error?.message||error)}); }
    });

    router.get('/config', (req, res) => res.json({ ok: true, config: redactConfig(loadConfig()) }));

    router.post('/config', (req, res) => {
        const input = req.body || {};
        const current = loadConfig();
        delete input.apiPool;
        if (input.llm && !String(input.llm.apiKey || '').trim()) delete input.llm.apiKey;
        if (input.relay && !String(input.relay.apiKey || '').trim()) delete input.relay.apiKey;
        if (input.companion && !String(input.companion.apiKey || '').trim()) delete input.companion.apiKey;
        if (input.phone && !String(input.phone.apiKey || '').trim()) delete input.phone.apiKey;
        if (input.controlAgent && !String(input.controlAgent.apiKey || '').trim()) delete input.controlAgent.apiKey;
        if (input.image && !String(input.image.apiKey || '').trim()) delete input.image.apiKey;
        if (input.embedding && !String(input.embedding.apiKey || '').trim()) delete input.embedding.apiKey;
        const next = saveConfig(deepMerge(current, input));
        res.json({ ok: true, config: redactConfig(next) });
    });

    router.get('/creative/presets', (req, res) => {
        try { res.json({ok:true,presets:listCreativePresets(),limit:MAX_CREATIVE_PRESETS,maxBytes:MAX_CREATIVE_PRESET_BYTES}); }
        catch (error) { res.status(500).json({ok:false,error:String(error?.message||error)}); }
    });

    router.get('/creative/presets/:id/history', (req, res) => {
        try {
            const file=creativePresetFile(req.params.id);
            if(!fs.existsSync(file))return res.status(404).json({ok:false,error:'preset-not-found'});
            res.json({ok:true,id:req.params.id,history:listCreativePresetHistory(req.params.id),limit:MAX_CREATIVE_PRESET_HISTORY});
        } catch (error) { res.status(400).json({ok:false,error:String(error?.message||error)}); }
    });

    router.get('/creative/presets/:id', (req, res) => {
        try {
            const stored=readJson(creativePresetFile(req.params.id),null);
            if(!stored?.preset) return res.status(404).json({ok:false,error:'preset-not-found'});
            res.json({ok:true,meta:creativePresetMeta(stored),preset:stored.preset});
        } catch (error) { res.status(400).json({ok:false,error:String(error?.message||error)}); }
    });

    router.post('/creative/presets', (req, res) => {
        try {
            const preset=req.body?.preset;
            const stats=validateCreativePreset(preset);
            const serialized=JSON.stringify(preset);
            const bytes=Buffer.byteLength(serialized,'utf8');
            if(!bytes||bytes>MAX_CREATIVE_PRESET_BYTES)throw new Error('preset-too-large');
            const id=`preset-${crypto.createHash('sha256').update(serialized).digest('hex').slice(0,20)}`;
            const file=creativePresetFile(id),existing=fs.existsSync(file);
            if(!existing&&listCreativePresets().length>=MAX_CREATIVE_PRESETS)throw new Error(`Chỉ được nhập tối đa ${MAX_CREATIVE_PRESETS} bộ preset`);
            const previous=existing?readJson(file,null):null;
            const name=String(req.body?.name||previous?.name||'Preset đã nhập').replace(/[\u0000-\u001f]/g,'').trim().slice(0,120)||'Preset đã nhập';
            const stored={schema:'vvv.creative.preset-store.v1',id,name,importedAt:Number(previous?.importedAt||Date.now()),updatedAt:Date.now(),bytes,stats,revision:creativePresetRevision(preset),preset};
            writeJsonAtomic(file,stored);
            res.status(existing?200:201).json({ok:true,reused:existing,meta:creativePresetMeta(stored)});
        } catch (error) { res.status(400).json({ok:false,error:String(error?.message||error)}); }
    });

    // POST is used for updates because older SillyTavern plugin routers only
    // expose GET/POST/DELETE.  The route is idempotent and guarded by the
    // expectedUpdatedAt compare-and-swap check below.
    router.post('/creative/presets/:id', (req, res) => {
        try {
            const id=String(req.params.id||'');
            const file=creativePresetFile(id),previous=readJson(file,null);
            if(!previous?.preset)return res.status(404).json({ok:false,error:'preset-not-found'});
            const expected=Number(req.body?.expectedUpdatedAt||0);
            if(expected&&Number(previous.updatedAt||0)!==expected)return res.status(409).json({ok:false,error:'preset-stale-revision',meta:creativePresetMeta(previous)});
            const preset=req.body?.preset,stats=validateCreativePreset(preset),serialized=JSON.stringify(preset),bytes=Buffer.byteLength(serialized,'utf8');
            if(!bytes||bytes>MAX_CREATIVE_PRESET_BYTES)throw new Error('preset-too-large');
            const name=String(req.body?.name||previous.name||preset?.presetName||'Preset đã nhập').replace(/[\u0000-\u001f]/g,'').trim().slice(0,120)||'Preset đã nhập';
            saveCreativePresetHistory(previous,'before-update');
            const stored={schema:'vvv.creative.preset-store.v1',id,name,importedAt:Number(previous.importedAt||Date.now()),updatedAt:Date.now(),bytes,stats,revision:creativePresetRevision(preset),preset};
            writeJsonAtomic(file,stored);
            res.json({ok:true,meta:creativePresetMeta(stored),history:listCreativePresetHistory(id)});
        } catch (error) { res.status(400).json({ok:false,error:String(error?.message||error)}); }
    });

    router.delete('/creative/presets/:id', (req, res) => {
        try {
            const file=creativePresetFile(req.params.id);
            if(!fs.existsSync(file))return res.status(404).json({ok:false,error:'preset-not-found'});
            fs.unlinkSync(file);
            res.json({ok:true,id:req.params.id});
        } catch (error) { res.status(400).json({ok:false,error:String(error?.message||error)}); }
    });

    router.post('/generate', async (req, res) => {
        try {
            const prompt = String(req.body?.prompt || '');
            const messages = normalizeStructuredMessages(req.body?.messages);
            if ((!prompt && !messages.length) || prompt.length > 2_000_000) throw new Error('invalid-relay-prompt');
            const config = loadConfig();
            if (!relayConfigured(config)) throw new Error('API riêng của Tiếp sức AI chưa được cấu hình');
            const maxTokens = Number(req.body?.maxTokens);
            const effective = cloneConfigWithLlm(relayCallConfig(config), {
                maxTokens: Number.isFinite(maxTokens) ? Math.max(128, Math.min(100000, maxTokens)) : undefined,
            });
            const result = await callLlm(effective, {
                prompt,
                systemPrompt: messages.length ? '' : withFictionContext(String(req.body?.systemPrompt || '').slice(0, 12000)),
                messages: messages.length ? withFictionContextMessages(messages) : null,
                feature: 'relay',
                jsonMode: Boolean(req.body?.jsonMode),
            });
            res.json({ ok:true, text:result.text, model:result.model, provider:result.provider, finishReason:result.finishReason||'', usage:result.usage || null, reusedMemoryApi:false, promptPipeline:req.body?.promptPipeline || null });
        } catch (error) {
            const detail=publicRelayError(error);
            res.status(400).json({ ok:false, error:detail.message, errorName:detail.name, errorCode:detail.code, policyRefusal:detail.policyRefusal });
        }
    });

    router.post('/relay/pipeline4', async (req, res) => {
        try {
            const prompt = String(req.body?.prompt || '');
            if (!prompt || prompt.length > 2_000_000) throw new Error('invalid-relay-pipeline-prompt');
            const config = loadConfig();
            const result = await runRelayPipeline4(config, {
                prompt,
                systemPrompt: withFictionContext(String(req.body?.systemPrompt || '').slice(0, 12000)),
                testMode: false,
            });
            res.json({ ok:true, text:result.text, debug:result.debug, usesMemoryApi:false, calls:4 });
        } catch (error) {
            res.status(400).json({ ok:false, error:String(error?.message || error) });
        }
    });

    router.post('/relay/pipeline4/test', async (req, res) => {
        try {
            const config = loadConfig();
            const result = await runRelayPipeline4(config, {
                prompt: '【CỐT TRUYỆN THỬ NGHIỆM】user vừa nói “Tôi đặt cốc nước lại lên bàn.” assistant đáp “Cô ấy liếc nhìn cốc nước trên bàn, không nói gì.” Chỉ dùng để kiểm tra chuỗi gọi bốn giai đoạn.',
                systemPrompt: withFictionContext('Đây là bài kiểm tra kết nối và dây chuyền Flash bốn tầng của 0-32, không liên quan tới cuộc trò chuyện thật.'),
                testMode: true,
            });
            res.json({ ok:true, text:result.text, debug:result.debug, calls:4 });
        } catch (error) {
            res.status(400).json({ ok:false, error:String(error?.message || error) });
        }
    });

    router.post('/relay/test', async (req, res) => {
        try {
            const config = loadConfig();
            if (!relayConfigured(config)) throw new Error('API riêng của Tiếp sức AI chưa được cấu hình');
            const result = await callLlm(relayCallConfig(config), {
                prompt: String(req.body?.prompt || 'Chỉ trả lời: Kết nối API tiếp sức thành công').slice(0, 2000),
                systemPrompt: 'Đây là bài kiểm tra kết nối Tiếp sức cốt truyện bằng AI.',
                feature: 'relay',
                jsonMode: false,
            });
            res.json({ ok:true, text:result.text, model:result.model, provider:result.provider, reusedMemoryApi:false });
        } catch (error) {
            const detail=publicRelayError(error);
            res.status(400).json({ ok:false, error:detail.message, errorName:detail.name, errorCode:detail.code, policyRefusal:detail.policyRefusal });
        }
    });

    router.get('/relay/models', async (req, res) => {
        try { res.json({ ok:true, models:await listModels(relayCallConfig(loadConfig())) }); }
        catch (error) { res.status(400).json({ ok:false, error:String(error?.message || error) }); }
    });

    router.post('/companion/generate', async (req, res) => {
        try {
            const prompt = String(req.body?.prompt || '');
            const messages = normalizeStructuredMessages(req.body?.messages);
            if ((!prompt && !messages.length) || prompt.length > 2_000_000) throw new Error('invalid-companion-prompt');
            const config = loadConfig();
            if (!companionConfigured(config)) throw new Error('API riêng của Bảy điều hậu trường chưa được cấu hình');
            const maxTokens = Number(req.body?.maxTokens);
            const effective = cloneConfigWithLlm(companionCallConfig(config), {
                maxTokens: Number.isFinite(maxTokens) ? Math.max(512, Math.min(100000, maxTokens)) : undefined,
            });
            const result = await callLlm(effective, {
                prompt,
                systemPrompt: messages.length ? '' : withFictionContext(String(req.body?.systemPrompt || '').slice(0, 12000)),
                messages: messages.length ? withFictionContextMessages(messages) : null,
                feature: 'companion',
                jsonMode: Boolean(req.body?.jsonMode),
            });
            res.json({ ok:true, text:result.text, model:result.model, provider:result.provider, usage:result.usage || null, source:'companion-independent-api', promptPipeline:req.body?.promptPipeline || null });
        } catch (error) {
            const detail=publicCompanionError(error);
            res.status(400).json({ ok:false, error:detail.message, errorName:detail.name, errorCode:detail.code, policyRefusal:detail.policyRefusal });
        }
    });

    router.post('/companion/test', async (req, res) => {
        try {
            const config = loadConfig();
            if (!companionConfigured(config)) throw new Error('API riêng của Bảy điều hậu trường chưa được cấu hình');
            const result = await callLlm(companionCallConfig(config), {
                prompt: String(req.body?.prompt || 'Chỉ trả lời: Kết nối API Bảy điều hậu trường thành công').slice(0, 2000),
                systemPrompt: 'Đây là bài kiểm tra kết nối API riêng của Bảy điều hậu trường trong tiểu thuyết hư cấu.',
                feature: 'companion',
                jsonMode: false,
            });
            res.json({ ok:true, text:result.text, model:result.model, provider:result.provider });
        } catch (error) { res.status(400).json({ ok:false, error:String(error?.message || error) }); }
    });

    router.get('/companion/models', async (req, res) => {
        try { res.json({ ok:true, models:await listModels(companionCallConfig(loadConfig())) }); }
        catch (error) { res.status(400).json({ ok:false, error:String(error?.message || error) }); }
    });

    router.post('/phone/generate', async (req, res) => {
        try {
            const prompt=String(req.body?.prompt||'');
            const messages=normalizeStructuredMessages(req.body?.messages, 300_000);
            if((!prompt&&!messages.length)||prompt.length>300_000)throw new Error('invalid-phone-prompt');
            const config=loadConfig();
            if(!phoneConfigured(config))throw new Error('API riêng của điện thoại thời gian thực chưa được cấu hình');
            const maxTokens=Number(req.body?.maxTokens);
            const effective=cloneConfigWithLlm(phoneCallConfig(config),{
                maxTokens:Number.isFinite(maxTokens)?Math.max(128,Math.min(12000,maxTokens)):undefined,
                temperature:Number.isFinite(Number(req.body?.temperature))?Math.max(0,Math.min(2,Number(req.body.temperature))):undefined,
            });
            const result=await callLlm(effective,{
                prompt,
                systemPrompt:messages.length?'':withFictionContext(String(req.body?.systemPrompt||'').slice(0,16000)),
                messages:messages.length?withFictionContextMessages(messages):null,
                feature:'phone',jsonMode:req.body?.jsonMode!==false,
            });
            res.json({ok:true,text:result.text,model:result.model,provider:result.provider,usage:result.usage||null,source:'phone-realtime-independent-api'});
        }catch(error){
            const detail=publicPhoneError(error);
            res.status(400).json({ok:false,error:detail.message,errorName:detail.name,errorCode:detail.code,policyRefusal:detail.policyRefusal});
        }
    });

    router.post('/phone/test', async (req,res)=>{
        try{
            const config=loadConfig();if(!phoneConfigured(config))throw new Error('API riêng của điện thoại thời gian thực chưa được cấu hình');
            const result=await callLlm(phoneCallConfig(config),{
                prompt:String(req.body?.prompt||'Chỉ xuất ra {"messages":[{"sender":"Liên hệ thử nghiệm","text":"Kết nối API điện thoại thời gian thực thành công","stickerId":""}],"action":{"type":"none","reason":""}}').slice(0,4000),
                systemPrompt:'Đây là bài kiểm tra kết nối tương tác thời gian thực của chiếc điện thoại trong tiểu thuyết hư cấu. Chỉ xuất ra đối tượng JSON hợp lệ.',feature:'phone',jsonMode:true,
            });
            res.json({ok:true,text:result.text,model:result.model,provider:result.provider,source:'phone-realtime-independent-api'});
        }catch(error){const detail=publicPhoneError(error);res.status(400).json({ok:false,error:detail.message,errorName:detail.name,errorCode:detail.code,policyRefusal:detail.policyRefusal});}
    });

    router.get('/phone/models',async(req,res)=>{
        try{res.json({ok:true,models:await listModels(phoneCallConfig(loadConfig()))});}
        catch(error){res.status(400).json({ok:false,error:String(error?.message||error)});}
    });

    router.get('/phone/stickers',(req,res)=>{
        const data=loadPhoneStickers();res.json({ok:true,stickers:data.stickers.map(phoneStickerPublic),maxCount:MAX_PHONE_STICKERS,maxBytes:MAX_PHONE_STICKER_BYTES});
    });
    router.post('/phone/stickers',(req,res)=>{
        try{
            const data=loadPhoneStickers();if(data.stickers.length>=MAX_PHONE_STICKERS)throw new Error(`Kho nhãn dán chứa tối đa ${MAX_PHONE_STICKERS} mục`);
            const decoded=decodePhoneStickerData(req.body?.data,req.body?.mimeType);
            const id=`sticker-${crypto.randomUUID()}`;const fileName=`${id}.${decoded.extension}`;const now=Date.now();
            const row={id,fileName,mimeType:decoded.mime,size:decoded.buffer.length,name:cleanPhoneStickerText(req.body?.name||'Nhãn dán chưa đặt tên',120)||'Nhãn dán chưa đặt tên',tags:String(req.body?.tags||'').split(/[,;\n]/).map(x=>cleanPhoneStickerText(x,40)).filter(Boolean).slice(0,24),description:cleanPhoneStickerText(req.body?.description,500),createdAt:now,updatedAt:now};
            fs.writeFileSync(path.join(PHONE_STICKERS_DIR(),fileName),decoded.buffer,{mode:0o600});
            data.stickers.push(row);savePhoneStickers(data);res.json({ok:true,sticker:phoneStickerPublic(row)});
        }catch(error){res.status(400).json({ok:false,error:String(error?.message||error)});}
    });
    router.patch('/phone/stickers/:id',(req,res)=>{
        try{
            const data=loadPhoneStickers(),id=safeId(req.params.id),row=data.stickers.find(item=>item.id===id);if(!row)return res.status(404).json({ok:false,error:'Nhãn dán không tồn tại'});
            if(Object.hasOwn(req.body||{},'name'))row.name=cleanPhoneStickerText(req.body.name,120)||row.name;
            if(Object.hasOwn(req.body||{},'tags'))row.tags=(Array.isArray(req.body.tags)?req.body.tags:String(req.body.tags||'').split(/[,;\n]/)).map(x=>cleanPhoneStickerText(x,40)).filter(Boolean).slice(0,24);
            if(Object.hasOwn(req.body||{},'description'))row.description=cleanPhoneStickerText(req.body.description,500);
            row.updatedAt=Date.now();savePhoneStickers(data);res.json({ok:true,sticker:phoneStickerPublic(row)});
        }catch(error){res.status(400).json({ok:false,error:String(error?.message||error)});}
    });
    router.delete('/phone/stickers/:id',(req,res)=>{
        try{
            const data=loadPhoneStickers(),id=safeId(req.params.id),index=data.stickers.findIndex(item=>item.id===id);if(index<0)return res.status(404).json({ok:false,error:'Nhãn dán không tồn tại'});
            const [row]=data.stickers.splice(index,1);if(row?.builtin&&!data.deletedBuiltinIds.includes(id))data.deletedBuiltinIds.push(id);savePhoneStickers(data);if(!row?.builtin){try{fs.unlinkSync(phoneStickerFile(row));}catch{}}
            res.json({ok:true,removed:id});
        }catch(error){res.status(400).json({ok:false,error:String(error?.message||error)});}
    });
    router.get('/phone/stickers/:id/image',(req,res)=>{
        const data=loadPhoneStickers(),id=safeId(req.params.id),row=data.stickers.find(item=>item.id===id);if(!row)return res.status(404).end();
        const file=phoneStickerFile(row);if(!fs.existsSync(file))return res.status(404).end();
        res.setHeader('Content-Type',row.mimeType);res.setHeader('Cache-Control','private, max-age=86400, immutable');res.setHeader('X-Content-Type-Options','nosniff');res.sendFile(path.resolve(file));
    });

    router.get('/portrait/assets',(req,res)=>{
        const subjectId=cleanPortraitText(req.query?.subjectId,160),data=loadPortraitAssets();
        const assets=subjectId?data.assets.filter(row=>row.subjectId===subjectId):data.assets;
        res.json({ok:true,assets:assets.map(portraitAssetPublic),maxCount:MAX_PORTRAIT_ASSETS,maxBytes:MAX_PORTRAIT_BYTES});
    });
    router.post('/portrait/assets',(req,res)=>{
        try{
            const data=loadPortraitAssets();if(data.assets.length>=MAX_PORTRAIT_ASSETS)throw new Error(`Kho ảnh nhân vật chứa tối đa ${MAX_PORTRAIT_ASSETS} ảnh`);
            const decoded=decodePortraitData(req.body?.data),id=`portrait-${crypto.randomUUID()}`,fileName=`${id}.${decoded.extension}`,now=Date.now();
            const row={id,fileName,kind:'reference',subjectId:cleanPortraitText(req.body?.subjectId,160),subjectName:cleanPortraitText(req.body?.subjectName,160),mimeType:decoded.mime,size:decoded.buffer.length,prompt:cleanPortraitText(req.body?.prompt,12000),negativePrompt:cleanPortraitText(req.body?.negativePrompt,12000),parentId:'',floor:-1,createdAt:now};
            if(!row.subjectId||!row.subjectName)throw new Error('Ảnh tham chiếu bắt buộc phải gắn với một nhân vật');
            fs.writeFileSync(path.join(PORTRAIT_ASSETS_DIR(),fileName),decoded.buffer,{mode:0o600});data.assets.push(row);savePortraitAssets(data);
            res.json({ok:true,asset:portraitAssetPublic(row)});
        }catch(error){res.status(400).json({ok:false,error:String(error?.message||error)});}
    });
    router.post('/portrait/generate',async(req,res)=>{
        try{
            const config=loadConfig(),data=loadPortraitAssets(),subjectId=cleanPortraitText(req.body?.subjectId,160),referenceId=safeId(req.body?.referenceId||'');
            if(data.assets.length>=MAX_PORTRAIT_ASSETS)throw new Error(`Kho ảnh nhân vật chứa tối đa ${MAX_PORTRAIT_ASSETS} ảnh, hãy xóa bớt ảnh cũ không cần trước`);
            const reference=data.assets.find(row=>row.id===referenceId&&row.subjectId===subjectId);if(!reference)throw new Error('Không tìm thấy ảnh tham chiếu của nhân vật này');
            const referenceFile=portraitAssetFile(reference);if(!fs.existsSync(referenceFile))throw new Error('Tệp ảnh tham chiếu đã bị mất');
            const prompt=cleanPortraitText(req.body?.prompt,16000),negativePrompt=cleanPortraitText(req.body?.negativePrompt,12000),floor=Number.isFinite(Number(req.body?.floor))?Number(req.body.floor):-1;
            const referenceBuffer=req.body?.referenceData?decodePortraitData(req.body.referenceData).buffer:fs.readFileSync(referenceFile);
            const generated=await queuePortraitGeneration(()=>generateNovelAiPortrait(config.image,{prompt,negativePrompt,referenceBuffer}));
            if(generated.buffer.length>MAX_PORTRAIT_BYTES)throw new Error('Ảnh NovelAI trả về quá lớn');
            const id=`portrait-${crypto.randomUUID()}`,fileName=`${id}.${generated.extension}`,row={id,fileName,kind:'generated',subjectId,subjectName:cleanPortraitText(req.body?.subjectName||reference.subjectName,160),mimeType:generated.mime,size:generated.buffer.length,prompt,negativePrompt,parentId:reference.id,floor,workflow:generated.workflow,fallbackUsed:Boolean(generated.fallbackUsed),createdAt:Date.now()};
            fs.writeFileSync(path.join(PORTRAIT_ASSETS_DIR(),fileName),generated.buffer,{mode:0o600});data.assets.push(row);savePortraitAssets(data);
            res.json({ok:true,asset:portraitAssetPublic(row),source:'novelai-character-reference-workflow',model:config.image.model,workflow:generated.workflow,requestedWorkflow:generated.requestedWorkflow,fallbackUsed:Boolean(generated.fallbackUsed)});
        }catch(error){res.status(400).json({ok:false,error:String(error?.message||error)});}
    });
    router.post('/portrait/test',async(req,res)=>{
        try{
            const config=loadConfig(),data=loadPortraitAssets(),referenceId=safeId(req.body?.referenceId||''),subjectId=cleanPortraitText(req.body?.subjectId,160);
            const reference=referenceId?data.assets.find(row=>row.id===referenceId&&(!subjectId||row.subjectId===subjectId)):null;
            if(referenceId&&!reference)throw new Error('Ảnh tham chiếu được chọn để thử không tồn tại hoặc không thuộc nhân vật hiện tại');
            const referenceFile=reference?portraitAssetFile(reference):'';if(reference&&!fs.existsSync(referenceFile))throw new Error('Tệp ảnh tham chiếu được chọn để thử đã bị mất');
            const prompt=cleanPortraitText(req.body?.prompt||'solo, full body, head-to-toe, entire body visible, feet visible, camera pulled back, environmental composition, fully clothed, best quality',16000);
            const referenceBuffer=reference?(req.body?.referenceData?decodePortraitData(req.body.referenceData).buffer:fs.readFileSync(referenceFile)):null;
            const startedAt=Date.now(),generated=await queuePortraitGeneration(()=>generateNovelAiPortrait({...config.image,enabled:true},{prompt,negativePrompt:config.image.negativePrompt,referenceBuffer}));
            res.json({ok:true,model:config.image.model,mode:generated.workflow,mimeType:generated.mime,size:generated.buffer.length,durationMs:Date.now()-startedAt,creditsWarning:true,fallbackUsed:Boolean(generated.fallbackUsed)});
        }catch(error){res.status(400).json({ok:false,error:String(error?.message||error)});}
    });
    router.delete('/portrait/assets/:id',(req,res)=>{
        try{
            const data=loadPortraitAssets(),id=safeId(req.params.id),index=data.assets.findIndex(row=>row.id===id);if(index<0)return res.status(404).json({ok:false,error:'Ảnh không tồn tại'});
            const [row]=data.assets.splice(index,1);savePortraitAssets(data);try{fs.unlinkSync(portraitAssetFile(row));}catch{}
            res.json({ok:true,removed:id});
        }catch(error){res.status(400).json({ok:false,error:String(error?.message||error)});}
    });
    router.get('/portrait/assets/:id/image',(req,res)=>{
        const data=loadPortraitAssets(),id=safeId(req.params.id),row=data.assets.find(item=>item.id===id);if(!row)return res.status(404).end();
        const file=portraitAssetFile(row);if(!fs.existsSync(file))return res.status(404).end();
        res.setHeader('Content-Type',row.mimeType);res.setHeader('Cache-Control','private, max-age=86400, immutable');res.setHeader('X-Content-Type-Options','nosniff');res.sendFile(path.resolve(file));
    });

    router.post('/test-llm', async (req, res) => {
        try {
            const result = await callLlm(loadConfig(), {
                prompt: String(req.body?.prompt || 'Chỉ trả lời: Kết nối thành công'),
                systemPrompt: 'Đây là bài kiểm tra kết nối.', feature: String(req.body?.feature || 'extract'),
            });
            res.json({ ok: true, text: result.text, model: result.model, provider: result.provider, usage: result.usage });
        } catch (error) { res.status(400).json({ ok: false, error: String(error?.message || error) }); }
    });

    router.get('/models', async (req, res) => {
        try { res.json({ ok: true, models: await listModels(loadConfig()) }); }
        catch (error) { res.status(400).json({ ok: false, error: String(error?.message || error) }); }
    });

    router.post('/control-agent/test', async (req,res)=>{
        try{
            const config=loadConfig();if(!controlAgentConfigured(config))throw new Error('API riêng của Quản gia AI toàn cục chưa được cấu hình');
            const result=await callLlm(controlAgentCallConfig(config),{prompt:'Chỉ trả lời: Kết nối Quản gia AI toàn cục thành công',systemPrompt:'Đây là bài kiểm tra kết nối.',feature:'controlAgent'});
            res.json({ok:true,text:result.text,model:result.model,provider:result.provider,usage:result.usage});
        }catch(error){res.status(400).json({ok:false,error:String(error?.message||error)});}
    });

    router.get('/control-agent/models',async(req,res)=>{
        try{res.json({ok:true,models:await listModels(controlAgentCallConfig(loadConfig()))});}
        catch(error){res.status(400).json({ok:false,error:String(error?.message||error)});}
    });

    router.get('/control-agent/capabilities', (req,res)=>{
        try {
            const config=loadConfig();
            res.json({ok:true,capabilities:controlAgentCapabilities(config)});
        } catch(error) { res.status(400).json({ok:false,error:String(error?.message||error)}); }
    });

    router.post('/test-embedding', async (req, res) => {
        try {
            const vectors = await embedTexts(loadConfig(), [String(req.body?.text || 'Kiểm tra kết nối')]);
            res.json({ ok: true, dimensions: vectors[0]?.length || 0, sample: vectors[0]?.slice(0, 5) || [] });
        } catch (error) { res.status(400).json({ ok: false, error: String(error?.message || error) }); }
    });


    // S3: hồ sơ vĩnh viễn của thẻ nhân vật. Trạng thái chính được ghi xuống đĩa độc lập theo “thẻ nhân vật → bản lưu cuộc trò chuyện”; nâng cấp/hạ cấp tiện ích không xóa.
    router.post('/archives/resolve', (req,res)=>{
        try{const out=resolveCardArchive({...req.body,create:req.body?.create!==false});if(!out)return res.status(404).json({ok:false,error:'archive-binding-not-found'});res.json({ok:true,...out});}
        catch(error){res.status(400).json({ok:false,error:String(error?.message||error)});}
    });
    router.post('/archives/state', (req,res)=>{
        try{const manifest=writeCardArchiveState({characterKey:String(req.body?.characterKey||''),archiveId:String(req.body?.archiveId||''),state:req.body?.state,reason:req.body?.reason||'normal',identity:req.body?.identity||{}});res.json({ok:true,complete:true,manifest});}
        catch(error){res.status(400).json({ok:false,error:String(error?.message||error)});}
    });
    router.post('/archives/state-chunk', (req,res)=>{
        let dir='';try{
            const uploadId=safeId(req.body?.uploadId||''),index=Number(req.body?.index),total=Number(req.body?.total),encoding=String(req.body?.encoding||'utf8-base64'),data=String(req.body?.data||'');
            if(!uploadId||!Number.isInteger(index)||!Number.isInteger(total)||index<0||index>=total||total<1||total>5000)throw new Error('invalid-archive-chunk');
            if(!['utf8-base64','gzip-base64'].includes(encoding))throw new Error('invalid-archive-encoding');
            if(!data||data.length>90000)throw new Error('archive-chunk-too-large');
            const chunk=Buffer.from(data,'base64');if(!chunk.length||chunk.length>70*1024)throw new Error('archive-chunk-invalid-bytes');
            dir=cardArchiveUploadDir(uploadId);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,`${String(index).padStart(5,'0')}.part`),chunk,{mode:0o600});
            writeJsonAtomic(path.join(dir,'meta.json'),{total,encoding,characterKey:String(req.body?.characterKey||''),archiveId:String(req.body?.archiveId||''),reason:String(req.body?.reason||'normal'),identity:req.body?.identity||{},updatedAt:Date.now()});
            const present=fs.readdirSync(dir).filter(n=>n.endsWith('.part')).length;if(present<total)return res.json({ok:true,received:present,total,complete:false});
            const buffers=[];for(let i=0;i<total;i+=1){const f=path.join(dir,`${String(i).padStart(5,'0')}.part`);if(!fs.existsSync(f))throw new Error(`archive-chunk-missing-${i}`);buffers.push(fs.readFileSync(f));}
            const meta=readJson(path.join(dir,'meta.json'),{}),packed=Buffer.concat(buffers),raw=encoding==='gzip-base64'?zlib.gunzipSync(packed):packed;if(raw.length>MAX_STATE_BYTES)throw new Error(`state-too-large>${MAX_STATE_BYTES}`);
            const state=JSON.parse(raw.toString('utf8'));const manifest=writeCardArchiveState({characterKey:meta.characterKey,archiveId:meta.archiveId,state,reason:meta.reason,identity:meta.identity});fs.rmSync(dir,{recursive:true,force:true});
            res.json({ok:true,complete:true,manifest});
        }catch(error){if(dir)try{fs.rmSync(dir,{recursive:true,force:true})}catch{}res.status(400).json({ok:false,error:String(error?.message||error)});}
    });
    router.post('/archives/phone-history-recovery', (req,res)=>{
        try{
            const characterKey=String(req.body?.characterKey||''),archiveId=String(req.body?.archiveId||''),chatKey=String(req.body?.chatKey||'');
            if(!characterKey||!archiveId||!chatKey)throw new Error('characterKey-archiveId-chatKey-required');
            const resolved=readCardArchive(characterKey,archiveId);
            if(!resolved?.manifest)throw new Error('archive-binding-not-found');
            const bundle=buildPhoneHistoryRecoveryBundle({characterKey,archiveId,chatKey});
            res.json({ok:true,...bundle});
        }catch(error){res.status(400).json({ok:false,error:String(error?.message||error)});}
    });
    router.post('/archives/phone-chronology-evidence', (req,res)=>{
        try{
            const characterKey=String(req.body?.characterKey||''),archiveId=String(req.body?.archiveId||''),chatKey=String(req.body?.chatKey||'');
            if(!characterKey||!archiveId||!chatKey)throw new Error('characterKey-archiveId-chatKey-required');
            const resolved=readCardArchive(characterKey,archiveId);
            if(!resolved?.manifest)throw new Error('archive-binding-not-found');
            res.json({ok:true,...buildPhoneChronologyEvidence({characterKey,archiveId,chatKey})});
        }catch(error){res.status(400).json({ok:false,error:String(error?.message||error)});}
    });

    router.post('/archives/character/export-by-identity', (req,res)=>{try{res.json({ok:true,bundle:exportCharacterArchiveBundleByIdentity(req.body||{})});}catch(error){res.status(404).json({ok:false,error:String(error?.message||error)});}});
    router.get('/archives/character/:characterKey/export', (req,res)=>{try{res.json({ok:true,bundle:exportCharacterArchiveBundle(req.params.characterKey)});}catch(error){res.status(400).json({ok:false,error:String(error?.message||error)});}});
    router.post('/archives/character/import', (req,res)=>{try{const result=importCharacterArchiveBundle(req.body?.bundle, String(req.body?.characterKey||''), String(req.body?.characterName||''), req.body?.currentIdentity||{});res.json({ok:true,...result});}catch(error){res.status(400).json({ok:false,error:String(error?.message||error)});}});

    router.post('/states/:chatKey/snapshot-chunk', (req, res) => {
        let dir = '';
        try {
            if (!String(req.body?.uploadId || '').trim()) throw new Error('uploadId-required');
            const uploadId = safeId(req.body.uploadId);
            const index = Number(req.body?.index);
            const total = Number(req.body?.total);
            const encoding = String(req.body?.encoding || 'utf8-base64');
            const reason = String(req.body?.reason || 'auto').slice(0,120);
            const data = String(req.body?.data || '');
            if (!uploadId || !Number.isInteger(index) || !Number.isInteger(total) || index < 0 || index >= total || total < 1 || total > 5000) throw new Error('invalid-snapshot-chunk');
            if (!['utf8-base64','gzip-base64'].includes(encoding)) throw new Error('invalid-snapshot-encoding');
            if (!data || data.length > 90000) throw new Error('snapshot-chunk-too-large');
            const chunk = Buffer.from(data, 'base64');
            if (!chunk.length || chunk.length > 70 * 1024) throw new Error('snapshot-chunk-invalid-bytes');
            dir = stateUploadDir(req.params.chatKey, uploadId);
            fs.mkdirSync(dir, { recursive:true });
            fs.writeFileSync(path.join(dir, `${String(index).padStart(5,'0')}.part`), chunk, { mode:0o600 });
            fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ total, encoding, reason, updatedAt:Date.now() }), { encoding:'utf8', mode:0o600 });
            const present = fs.readdirSync(dir).filter(name => name.endsWith('.part')).length;
            if (present < total) return res.json({ ok:true, received:present, total, complete:false });
            const buffers=[];
            for (let i=0;i<total;i+=1) {
                const partFile=path.join(dir, `${String(i).padStart(5,'0')}.part`);
                if (!fs.existsSync(partFile)) throw new Error(`snapshot-chunk-missing-${i}`);
                buffers.push(fs.readFileSync(partFile));
            }
            const packed=Buffer.concat(buffers);
            const raw=encoding==='gzip-base64' ? zlib.gunzipSync(packed) : packed;
            if (raw.length > MAX_STATE_BYTES) throw new Error(`state-too-large>${MAX_STATE_BYTES}`);
            const state=JSON.parse(raw.toString('utf8'));
            const meta=writeStateSnapshot(req.params.chatKey,state,reason);
            fs.rmSync(dir,{recursive:true,force:true});
            return res.json({ok:true,complete:true,snapshot:meta});
        } catch (error) {
            if (dir) { try { fs.rmSync(dir,{recursive:true,force:true}); } catch {} }
            return res.status(400).json({ok:false,error:String(error?.message||error)});
        }
    });

    router.post('/states/:chatKey/snapshot', (req, res) => {
        try {
            const meta = writeStateSnapshot(req.params.chatKey, req.body?.state, req.body?.reason || 'auto');
            res.json({ ok: true, snapshot: meta });
        } catch (error) { res.status(400).json({ ok:false, error:String(error?.message || error) }); }
    });

    router.get('/states/:chatKey/latest', (req, res) => {
        const item = stateSnapshotList(req.params.chatKey)[0];
        if (!item) return res.status(404).json({ ok:false, error:'state-backup-not-found' });
        const data = readJson(item.file, null);
        if (!data?.state) return res.status(500).json({ ok:false, error:'state-backup-corrupt' });
        res.json({ ok:true, snapshot:{ id:item.id, chatKey:data.chatKey || String(req.params.chatKey), createdAt:data.createdAt, reason:data.reason, metrics:data.metrics }, state:data.state });
    });

    router.get('/states/:chatKey/history', (req, res) => {
        const history = stateSnapshotList(req.params.chatKey).slice(0, RECOVERY_SCAN_MAX).map(item => {
            const data = readJson(item.file, {});
            return { id:item.id, chatKey:data.chatKey || String(req.params.chatKey), createdAt:data.createdAt || item.mtimeMs, reason:data.reason || '', metrics:data.metrics || {}, size:item.size };
        });
        res.json({ ok:true, history });
    });

    router.get('/states/:chatKey/:snapshotId', (req, res) => {
        const id = safeId(req.params.snapshotId);
        const file = path.join(stateChatDir(req.params.chatKey), `${id}.json`);
        const data = readJson(file, null);
        if (!data?.state) return res.status(404).json({ ok:false, error:'state-backup-not-found' });
        res.json({ ok:true, snapshot:{ id, chatKey:data.chatKey || String(req.params.chatKey), createdAt:data.createdAt, reason:data.reason, metrics:data.metrics }, state:data.state });
    });

    router.post('/tasks', (req, res) => {
        const type = String(req.body?.type || 'llm');
        const allowed = new Set(['llm', 'rebuild-index', 'search-index']);
        if (!allowed.has(type)) return res.status(400).json({ ok: false, error: 'invalid-task-type' });
        const dedupeKey=String(req.body?.dedupeKey||'').slice(0,300);
        if(dedupeKey){
            const now=Date.now();
            const existing=[...tasks.values()].filter(task=>task.account===activeAccount()&&task.type===type&&task.chatKey===String(req.body?.chatKey||'')&&task.dedupeKey===dedupeKey&&['queued','running','completed'].includes(task.status)&&now-Number(task.createdAt||0)<30*60*1000).sort((a,b)=>Number(b.createdAt)-Number(a.createdAt))[0];
            if(existing)return res.status(existing.status==='completed'?200:202).json({ok:true,reused:true,task:publicTask(existing,false)});
        }
        const task = createTask(type, req.body || {});
        return res.status(202).json({ ok: true, reused:false, task: publicTask(task, false) });
    });

    router.get('/tasks', (req, res) => {
        const chatKey = String(req.query?.chatKey || '');
        const list = [...tasks.values()].filter(task => task.account === activeAccount() && (!chatKey || task.chatKey === chatKey))
            .sort((a, b) => Number(b.createdAt) - Number(a.createdAt)).slice(0, 100)
            .map(task => publicTask(task, false));
        res.json({ ok: true, tasks: list });
    });

    router.delete('/tasks', (req, res) => {
        const chatKey = String(req.query?.chatKey || '');
        if (!chatKey) return res.status(400).json({ ok: false, error: 'chatKey-required' });
        let removed = 0, cancelled = 0;
        for (const [id, task] of [...tasks.entries()]) {
            if (task.account !== activeAccount() || task.chatKey !== chatKey) continue;
            if (['queued', 'running'].includes(task.status)) {
                task.cancelled = true; task.status = 'cancelled'; task.progress = 100; task.error = 'Tác vụ đã bị hủy bởi thao tác dọn sạch một chạm'; task.result = null; task.updatedAt = Date.now();
                persistTask(task); cancelled += 1;
            } else {
                tasks.delete(id); try { fs.unlinkSync(taskFile(id)); } catch {} removed += 1;
            }
        }
        res.json({ ok: true, removed, cancelled });
    });

    router.get('/tasks/:id', (req, res) => {
        const task = tasks.get(String(req.params.id));
        if (!task || task.account !== activeAccount()) return res.status(404).json({ ok: false, error: 'task-not-found' });
        return res.json({ ok: true, task: publicTask(task, true) });
    });

    router.post('/indexes/:chatKey/rebuild', async (req, res) => {
        const chatKey=String(req.params.chatKey||''); const documents=Array.isArray(req.body?.documents)?req.body.documents:[];
        const manifest=documents.map(doc=>`${doc?.id||''}:${doc?.sourceHash||''}`).sort().join('|');
        const dedupeKey=stableHashId('index-rebuild',`${chatKey}|${manifest}`);
        const existing=[...tasks.values()].filter(task=>task.account===activeAccount()&&task.type==='rebuild-index'&&task.chatKey===chatKey&&task.dedupeKey===dedupeKey&&['queued','running','completed'].includes(task.status)&&Date.now()-Number(task.createdAt||0)<30*60*1000).sort((a,b)=>Number(b.createdAt)-Number(a.createdAt))[0];
        if(existing)return res.status(existing.status==='completed'?200:202).json({ok:true,reused:true,task:publicTask(existing,false)});
        const task = createTask('rebuild-index', { chatKey, documents, dedupeKey });
        res.status(202).json({ ok: true, reused:false, task: publicTask(task, false) });
    });

    router.post('/indexes/:chatKey/search', async (req, res) => {
        try {
            const results = await searchIndex(req.params.chatKey, String(req.body?.query || ''), req.body?.options || {}, loadConfig());
            res.json({ ok: true, results });
        } catch (error) { res.status(400).json({ ok: false, error: String(error?.message || error) }); }
    });

    router.get('/indexes/:chatKey/status', (req, res) => {
        const exists = fs.existsSync(indexFile(req.params.chatKey));
        const index = exists ? loadIndexCached(req.params.chatKey) : null;
        const docs = index?.documents || [];
        res.json({ ok: true, exists, revision:Number(index?.revision||0), generation:index?.generation||'', sourceManifestHash:index?.sourceManifestHash||'', count: docs.length,
            vectorCount: docs.filter(doc => Array.isArray(doc.vector) && doc.vector.length).length,
            coreCount: docs.filter(doc => doc.tier === 'core').length,
            hotCount: docs.filter(doc => doc.tier === 'hot').length,
            coldCount: docs.filter(doc => doc.tier === 'cold').length,
            tagCount: Object.keys(index?.associationGraph?.counts || {}).length,
            associationEdges: Object.values(index?.associationGraph?.edges || {}).reduce((sum,list)=>sum+(Array.isArray(list)?list.length:0),0),
            updatedAt: index?.updatedAt || null });
    });

    router.delete('/indexes/:chatKey', (req, res) => {
        try { fs.unlinkSync(indexFile(req.params.chatKey)); } catch {}
        clearIndexCache(req.params.chatKey);
        res.json({ ok: true });
    });

    console.log(`[${PLUGIN_ID}] v${VERSION} loaded for account vvv only`);
    return Promise.resolve();
}

export async function exit() {
    if (cleanupTimer) clearInterval(cleanupTimer);
}

export const info = {
    id: PLUGIN_ID,
    name: '0-32 · Sân Khấu Không Bao Giờ Hạ Màn · Máy chủ Trung tâm Ký ức',
    description: '0-32/R9S1P41-S10: kho tư liệu vĩnh viễn riêng theo thẻ nhân vật + cuộc trò chuyện, lưu không phá hủy, ảnh chụp vĩnh viễn, CardVault bundle v2, cứu hộ lịch sử điện thoại và truy xuất liên tưởng kiểu vector/BM25/VCP; các phần sắp xếp, tổng kết, Tiếp sức AI và Bảy điều hậu trường dùng API riêng của từng phần với ranh giới tư liệu hữu hạn.',
};
