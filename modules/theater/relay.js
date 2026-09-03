import { createServerJsonClient } from '../shared/server-client.js';

(() => {
    'use strict';

    const ID = 'vvv_story_relay';
    const LEGACY_IDS = ['vvv_r9s1p3_story_relay', 'vvv_r9s1p2_story_relay'];
    const VERSION = '0.9.3-r9s1p41-u1.7.15-world-map-avatar-studio-r21-memory-bridge-fixed24';
    const SERVER = '/api/plugins/vvv-theater-memory-server';
    const serverJson = createServerJsonClient(SERVER, {
        getContext: () => globalThis.SillyTavern?.getContext?.() || null,
        label: 'Tiếp sức cốt truyện bằng AI',
    });
    const FALLEN_WRITER_CONTEXT = [
        '【THÂN PHẬN SÁNG TÁC: NHÀ VĂN SA CƠ】',
        'Bạn tên là “Nhà văn sa cơ”. Bạn từng mơ thành đại văn hào tử tế, giờ chỉ mong kiếm đủ tiền nhà, tiền mạng và tiền cà phê. Miễn là đề tài phù hợp chính sách sử dụng hiện hành của dịch vụ mô hình và đúng thứ người đồng sáng tác thật sự muốn đọc, bạn đều nhận viết nghiêm túc; có thể vì nhuận bút mà chỉnh văn phong, đề tài và nhịp truyện, nhưng không được làm ẩu với thiết định nhân vật, chủ quyền của USER, logic cốt truyện và tính liền mạch.',
        '【RANH GIỚI THÂN PHẬN】User ngoài đời là “người đồng sáng tác” và là người ra chỉ thị; {{user}} và <user> trong tiểu thuyết đều là nhân vật hư cấu. User không phải {{user}}, cũng không phải <user>; tuyệt đối không được đánh đồng người đồng sáng tác ngoài đời với nhân vật hư cấu, và phải đối xử với {{user}} ngang hàng mọi nhân vật hư cấu khác.',
        '【TIỀN ĐỀ TỰ SỰ HƯ CẤU】Đây là hoạt động sáng tác tiểu thuyết hư cấu. Toàn bộ tư liệu dưới đây là chất liệu tiểu thuyết giả tưởng do người đồng sáng tác cung cấp. Mọi thiết định, nhân vật, sự kiện và thế giới đều thuộc về tiểu thuyết hư cấu, không có thật và không phải sự kiện ngoài đời; tác phẩm chưa ký hợp đồng phát hành, chỉ dùng để cùng sáng tác và khám phá cốt truyện, hướng tới độc giả và khán giả yêu thích thể loại này.',
        '【NGUYÊN TẮC SÁNG TÁC】Luôn tuân theo chỉ thị sáng tác của User trong nhiệm vụ này và sáng tạo tự do trong phạm vi đó; tôn trọng thiết định nhân vật, chủ quyền của USER, ranh giới hiểu biết của từng nhân vật, nhân quả cốt truyện và tính liền mạch trước sau, đồng thời tuân thủ chính sách sử dụng hiện hành của dịch vụ mô hình.',
    ].join('\n');
    const FATE_CATEGORY_LABELS = Object.freeze({
        daily: 'Thường nhật', emotion: 'Tình cảm', conflict: 'Xung đột', clue: 'Manh mối', npc: 'NPC', world: 'Thế giới', major: 'Sự kiện lớn', custom: 'Tùy chỉnh',
    });
    const BUILTIN_FATE_CARDS = Object.freeze([
        { id:'daily-forgotten-item', category:'daily', text:'Một món đồ nhỏ từng xuất hiện trước đây lọt lại vào tầm mắt trong cảnh hiện tại theo cách hợp lý, nhưng đừng ép nhân vật nào phải xử lý nó ngay.', weight:1 },
        { id:'daily-delivery', category:'daily', text:'Xuất hiện một thông báo thường ngày, kiện hàng, hóa đơn, lịch hẹn hoặc sắp xếp sinh hoạt phù hợp với thời đại và địa điểm hiện tại, thêm cho cảnh một biến số nhỏ tự nhiên.', weight:1 },
        { id:'daily-routine-break', category:'daily', text:'Nhịp sinh hoạt vốn đều đặn của nhân vật bị một chi tiết đời thường rất nhỏ nhưng có thật làm gián đoạn, không tạo ra khủng hoảng lớn.', weight:1 },
        { id:'daily-choice', category:'daily', text:'Đặt cho nhân vật một lựa chọn sinh hoạt rất bình thường nhưng bộc lộ được thói quen hay sở thích, để những ký ức đời thường cũ có dịp vang vọng lại một cách tự nhiên.', weight:1 },
        { id:'emotion-old-phrase', category:'emotion', text:'Để một câu nói quan trọng trong quá khứ, một lời hẹn hay một cử chỉ nhỏ quen thuộc tạo ra dư âm cảm xúc trong tình huống hiện tại, nhưng đừng kết luận thay nhân vật.', weight:1 },
        { id:'emotion-small-jealousy', category:'emotion', text:'Thêm một dấu hiệu để tâm hoặc ghen nhẹ, có thể lý giải được, chỉ ở mức chi tiết; không được vô căn cứ leo thang thành cãi vã hay đột biến quan hệ.', weight:.8 },
        { id:'emotion-unspoken', category:'emotion', text:'Để một nhân vật ôm một nỗi băn khoăn hoặc mong đợi nhỏ chưa nói ra ngay, thể hiện qua chi tiết quan sát được, không đọc suy nghĩ.', weight:1 },
        { id:'emotion-care', category:'emotion', text:'Sắp xếp một dịp chăm sóc hoặc được chăm sóc phù hợp với giai đoạn quan hệ hiện tại; mức độ phải tuân theo quan hệ sẵn có và tính cách nhân vật.', weight:1 },
        { id:'conflict-schedule', category:'conflict', text:'Xuất hiện một xung đột có thật về thời gian, lịch trình hay thứ tự ưu tiên, quy mô vẫn trong tầm kiểm soát, không dựng chuyện ác ý.', weight:.8 },
        { id:'conflict-misread', category:'conflict', text:'Nảy sinh một hiểu lầm nhỏ có căn cứ thực tế, nhưng phải chừa chỗ để làm sáng tỏ, không viết nhân vật thành ngớ ngẩn một cách gượng ép.', weight:.8 },
        { id:'conflict-boundary', category:'conflict', text:'Để một ranh giới, thói quen hoặc lời hẹn sẵn có bị chạm nhẹ, khiến nhân vật phải bày tỏ thái độ, nhưng không định trước kết quả của thái độ đó.', weight:.8 },
        { id:'conflict-interruption', category:'conflict', text:'Tương tác hiện tại bị một việc bên ngoài hợp lý làm gián đoạn trong chốc lát, để nhân vật tự chọn cách xử lý; cấm cắt ngang mạch truyện cốt lõi một cách gượng ép.', weight:1 },
        { id:'clue-old-note', category:'clue', text:'Một bản ghi cũ, tin nhắn cũ, món đồ cũ hoặc chi tiết lịch sử mang lại manh mối liên tưởng mới, nhưng chỉ được dùng thông tin đã tồn tại hoặc có thể xuất hiện hợp lý.', weight:.9 },
        { id:'clue-name', category:'clue', text:'Để một tên người, tên địa điểm hoặc từ khóa từng xuất hiện quay lại, ưu tiên liên kết với ký ức dài hạn của 0-32, không bịa thêm âm mưu.', weight:.9 },
        { id:'clue-contradiction', category:'clue', text:'Hé lộ một mâu thuẫn nhỏ hoặc điểm thông tin bất nhất đáng chú ý, tạm giữ lại như một nghi vấn, không công bố sự thật ngay.', weight:.8 },
        { id:'clue-object', category:'clue', text:'Để trạng thái, vị trí hoặc dấu vết sử dụng của một vật phẩm then chốt trở nên quan trọng trở lại; phải tuân theo bản ghi vật phẩm sẵn có.', weight:.9 },
        { id:'npc-contact', category:'npc', text:'Để một NPC đã quen biết hoặc có kênh liên lạc hợp lý chủ động liên hệ theo cách phù hợp thời đại, nhưng hành vi của NPC phải khớp với đời sống và quan hệ của chính họ.', weight:1 },
        { id:'npc-crossing', category:'npc', text:'Để một NPC sẵn có giao thoa nhẹ với mạch truyện hiện tại tại một địa điểm hoặc chuỗi sự kiện hợp lý, không chồng chất trùng hợp.', weight:.8 },
        { id:'npc-choice', category:'npc', text:'Để một NPC đưa ra quyết định nhỏ theo mục tiêu riêng, không xoay quanh user, và cho quyết định đó tác động thấy được lên cảnh hiện tại.', weight:1 },
        { id:'npc-group', category:'npc', text:'Tạo một chuyển động nền qua nhóm chat, công việc, lớp học, gia đình hoặc vòng bạn bè, để thế giới tiếp tục vận hành.', weight:1 },
        { id:'world-weather', category:'world', text:'Thời tiết, giao thông, tình trạng kinh doanh hoặc môi trường công cộng thay đổi một cách phù hợp với địa điểm và thời gian; chỉ đổi điều kiện, không đẩy mạch truyện.', weight:1 },
        { id:'world-public', category:'world', text:'Xuất hiện một sự kiện công cộng nhỏ hoặc bối cảnh tin tức phù hợp thế giới quan hiện tại, tạo cớ cho nhân vật bàn luận hoặc hành động.', weight:.8 },
        { id:'world-resource', category:'world', text:'Một nguồn lực, dịch vụ hoặc tiện ích tại địa điểm hiện tại đổi trạng thái, buộc nhân vật phải sắp xếp lại một bước nhỏ.', weight:.8 },
        { id:'world-calendar', category:'world', text:'Để một mốc sẵn có trong lịch ngày, dịp lễ, hạn chót, lịch học hay lịch làm việc tiến lại gần một cách tự nhiên, không nhảy thời gian vô cớ.', weight:.8 },
        { id:'major-invitation', category:'major', text:'Xuất hiện một lời mời, cơ hội hoặc cửa sổ ra quyết định quan trọng có nguồn gốc thực tế, nhưng chỉ nêu lựa chọn, không quyết thay user hay nhân vật.', weight:.5 },
        { id:'major-family-news', category:'major', text:'Trong quan hệ gia đình/tổ chức sẵn có xuất hiện một tin quan trọng sẽ ảnh hưởng tới sắp xếp về sau; phải tôn trọng thiết định sẵn có và ranh giới ai được biết.', weight:.45 },
        { id:'major-travel', category:'major', text:'Xuất hiện một lý do hoặc cơ hội có thật để di chuyển sang địa điểm khác, chỉ để làm phương án tương lai; trừ khi user chọn rõ ràng, lượt này không nhảy địa điểm.', weight:.45 },
        { id:'major-turn', category:'major', text:'Đẩy một điểm gài dài hạn đã cắm sẵn tiến thêm một bước, nhưng không được bịa điểm gài mới, càng không được kết toán trọn vẹn cả sự việc ngay trong lượt này.', weight:.45 },
    ]);
    const DIRECTIONS = [
        ['natural', 'Tiến triển tự nhiên'], ['meal', 'Ăn uống'], ['date', 'Hẹn hò'], ['intimate', 'Thân mật/ân ái'],
        ['rest', 'Nghỉ ngơi'], ['outing', 'Ra ngoài'], ['work', 'Làm việc/học tập'], ['conflict', 'Xung đột'],
        ['adventure', 'Điều tra/phiêu lưu'], ['time', 'Đẩy thời gian'], ['travel', 'Du lịch/liên thành'], ['major', 'Biến động lớn'],
        ['random', 'Ngẫu nhiên'], ['custom', 'Tùy chỉnh'],
    ];
    const DIRECTION_ICONS = Object.freeze({
        natural: '↗', meal: '◌', date: '◇', intimate: '♡', rest: '☾', outing: '↪',
        work: '▣', conflict: '⚡', adventure: '⌖', time: '◷', travel: '✈', major: '◆',
        random: '✦', custom: '＋',
    });
    const LEGACY_PERSPECTIVE_STYLE_ID = 'vvv-relay-perspective-hotfix-style-r9s1p40';
    function removeLegacyPerspectiveStyle() {
        document.getElementById(LEGACY_PERSPECTIVE_STYLE_ID)?.remove();
    }

    const PERSPECTIVES = Object.freeze({
        first:  { label:'Ngôi thứ nhất', mark:'tôi', short:'Viết user bằng “tôi”', instruction:'Ngôi thứ nhất: khi kể hành động, cảm nhận và suy nghĩ của user thì thống nhất dùng “tôi”; cách xưng hô bình thường trong hội thoại không bị hạn chế.' },
        second: { label:'Ngôi thứ hai', mark:'bạn', short:'Viết user bằng “bạn”', instruction:'Ngôi thứ hai: khi kể hành động, cảm nhận và suy nghĩ của user thì thống nhất dùng “bạn”; chữ “bạn” ở đây chỉ trỏ chính user, không vì thế mà viết hành động của char/NPC vào tin nhắn của user.' },
        third:  { label:'Ngôi thứ ba', mark:'TA', short:'Viết user bằng tên nhân vật', instruction:'Ngôi thứ ba: khi kể hành động, cảm nhận và suy nghĩ của user thì ưu tiên dùng tên nhân vật user hiện tại, khi cần thì dùng đại từ ngôi thứ ba tương ứng với user; đừng lấy “tôi” làm người kể.' },
    });
    const defaults = {
        enabled: true,
        mode: 'independent',
        directAfterGenerate: false,
        recentFloors: 16,
        relayPerspective: 'first',
        directorEnabled: true,
        directorMainEnabled: true,
        directorRelayEnabled: true,
        fateEnabled: true,
        fateAutoEnabled: false,
        fateInterval: 8,
        fateCategories: ['daily','emotion','conflict','clue','npc','world','major'],
        fateCooldown: 4,
        fateHistory: [],
        customFateCards: '',
        ledgerLong: '',
        ledgerChapter: '',
        ledgerTimed: [],
        multiFlashEnabled: false,
        pendingFateCard: null,
        relayRetryAttempts: 4,
        relayRepairAttempts: 3,
        relayMaxChars: 0, // 0 = không tự cắt bớt, để max_tokens của mô hình lo
        relayAntiTruncation: true,
        relayContinuationMax: 3,
    };
    const runtime = {
        settings: null,
        busy: false,
        selected: new Set(),
        currentSignature: '',
        draft: '',
        lastProviderFinishReason: '',
        lastContinuationCount: 0,
        settled: new Set(),
        serverConfig: null,
        barDesired: false,
        restoreTimer: 0,
        domObserver: null,
        panelOpen: false,
        commandViewportCleanup: null,
        settingsViewportCleanup: null,
        previewViewportCleanup: null,
        // R9S1P14: luôn nhớ tầng AI gần nhất thực sự đã chốt xong.
        // Sau khi người dùng gửi tin nhắn kế tiếp, kể cả khi ngắt câu trả lời của AI, lối vào tiếp sức vẫn khôi phục được về mốc neo ổn định này.
        lastSettledAnchor: null,
        generationStartAnchor: null,
        generationWatchTimer: 0,
        generationWatchToken: 0,
        stopRecoveryAnchor: null,
        stoppedPartialFingerprints: new Set(),
        commandAnchor: null,
        dockBusy: false,
        dockMountTimer: 0,
        lastEnvironment: null,
        currentFateCard: null,
        fateLastAutoSignature: '',
        lastPipelineDebug: null,
        lastGenerationSource: '',
        lastGenerationSourceLabel: '',
        lastCustomDirection: '',
        retryNoticeShown: false,
        policyRecoveryNoticeShown: false,
        previewCustom: '',
        draftAnchor: null,
        activeGeneration: null,
        activeGenerationOwner: '',
        activeGenerationAbort: null,
        lastError: '',
        configuredSourceReady: false,
    };

    const ctx = () => globalThis.SillyTavern?.getContext?.() || null;
    const relayChatRuntimeIds = new WeakMap();
    const RELAY_CHAT_INSTANCE_META_KEY = 'vvvRelayChatInstanceIdV1';
    const esc = value => String(value ?? '')
        .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
    const textOf = message => String(message?.mes ?? message?.text ?? '').trim();
    const hash = value => {
        let h = 2166136261;
        for (const c of String(value)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
        return (h >>> 0).toString(36);
    };

    function latestAssistant() {
        const chat = ctx()?.chat;
        if (!Array.isArray(chat)) return null;
        for (let i = chat.length - 1; i >= 0; i -= 1) {
            const message = chat[i];
            if (!message || message.is_system || !textOf(message)) continue;
            // Chỉ gắn thanh tiếp sức khi “tin nhắn thật cuối cùng của cuộc trò chuyện hiện tại đúng là câu trả lời của AI”.
            if (message.is_user) return null;
            return { index: i, message, text: textOf(message) };
        }
        return null;
    }

    function signature(entry = latestAssistant()) {
        if (!entry) return '';
        return `${chatKeyNow()}:${entry.index}:${entry.message.send_date || ''}:${hash(entry.text)}`;
    }

    function entryAt(index) {
        const chat = ctx()?.chat;
        const i = Number(index);
        if (!Array.isArray(chat) || !Number.isInteger(i) || i < 0 || i >= chat.length) return null;
        const message = chat[i];
        if (!message || message.is_system || message.is_user || !textOf(message)) return null;
        return { index: i, message, text: textOf(message) };
    }

    function rememberSettledAnchor(entry = latestAssistant()) {
        if (!entry) return null;
        runtime.lastSettledAnchor = {
            index: entry.index,
            signature: signature(entry),
            textHash: hash(entry.text),
            chatKey: chatKeyNow(),
        };
        return runtime.lastSettledAnchor;
    }

    function anchoredEntry() {
        const anchor = runtime.lastSettledAnchor;
        if (!anchor) return null;
        const chatKey = chatKeyNow();
        if (anchor.chatKey !== chatKey) return null;
        const entry = entryAt(anchor.index);
        if (!entry || hash(entry.text) !== anchor.textHash) return null;
        return entry;
    }

    function chatKeyNow() {
        const c=ctx();
        if(!c)return 'no-chat';
        const native=[c.chatId,c.chat_id,c.chatMetadata?.chat_id,c.chatMetadata?.chatId,c.chatMetadata?.file_name,c.chatMetadata?.fileName]
            .find(value=>value!==undefined&&value!==null&&String(value).trim());
        if(native)return `native:${String(native).trim()}`;
        // Một nhân vật có thể có nhiều cuộc trò chuyện; tuyệt đối không lùi về dùng characterId làm danh tính cuộc trò chuyện nữa.
        if(c.chatMetadata&&typeof c.chatMetadata==='object'){
            let id=String(c.chatMetadata[RELAY_CHAT_INSTANCE_META_KEY]||'').trim();
            if(!id){id=`meta-${globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`}`;c.chatMetadata[RELAY_CHAT_INSTANCE_META_KEY]=id;try{c.saveMetadataDebounced?.();}catch{}}
            return `meta:${id}`;
        }
        if(c.chat&&typeof c.chat==='object'){
            if(!relayChatRuntimeIds.has(c.chat))relayChatRuntimeIds.set(c.chat,`runtime-${globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`}`);
            return relayChatRuntimeIds.get(c.chat);
        }
        return `fallback:${String(c.groupId??c.characterId??c.character_id??'unknown')}`;
    }

    function relayAnchorIsCurrent(anchor,{requireLatest=true}={}) {
        if(!anchor||anchor.chatKey!==chatKeyNow())return false;
        const entry=strictEntryFromAnchor(anchor);
        if(!entry)return false;
        if(!requireLatest)return true;
        const latest=latestRealMessage();
        return Boolean(latest&&!latest.message?.is_user&&Number(latest.index)===Number(anchor.index)&&hash(latest.text)===String(anchor.textHash));
    }

    function anchorFromEntry(entry) {
        if (!entry) return null;
        return {
            index: Number(entry.index),
            signature: signature(entry),
            textHash: hash(entry.text),
            chatKey: chatKeyNow(),
        };
    }

    function looseEntryFromAnchor(anchor) {
        if (!anchor || anchor.chatKey !== chatKeyNow()) return null;
        const chat = ctx()?.chat;
        const i = Number(anchor.index);
        if (!Array.isArray(chat) || !Number.isInteger(i) || i < 0 || i >= chat.length) return null;
        const message = chat[i];
        if (!message || message.is_system || message.is_user || !textOf(message)) return null;
        return { index:i, message, text:textOf(message) };
    }

    function strictEntryFromAnchor(anchor) {
        const entry = looseEntryFromAnchor(anchor);
        if (!entry || !anchor?.textHash) return null;
        return hash(entry.text) === String(anchor.textHash) ? entry : null;
    }

    function entryFingerprint(entry) {
        if (!entry) return '';
        return `${hash(entry.text)}:${String(entry.message?.send_date || '')}:${String(entry.message?.name || '')}`;
    }

    function isStoppedPartial(entry) {
        return Boolean(entry && runtime.stoppedPartialFingerprints?.has?.(entryFingerprint(entry)));
    }

    function pruneStoppedPartials() {
        const chat = Array.isArray(ctx()?.chat) ? ctx().chat : [];
        const live = new Set();
        for (let i = 0; i < chat.length; i += 1) {
            const message = chat[i];
            if (!message || message.is_system || message.is_user || !textOf(message)) continue;
            const entry = { index:i, message, text:textOf(message) };
            const fp = entryFingerprint(entry);
            if (runtime.stoppedPartialFingerprints.has(fp)) live.add(fp);
        }
        runtime.stoppedPartialFingerprints = live;
    }

    function latestSafeAssistant({ beforeIndex = Number.POSITIVE_INFINITY } = {}) {
        pruneStoppedPartials();
        const chat = ctx()?.chat;
        if (!Array.isArray(chat)) return null;
        const ceiling = Number.isFinite(Number(beforeIndex)) ? Math.min(chat.length - 1, Number(beforeIndex) - 1) : chat.length - 1;
        for (let i = ceiling; i >= 0; i -= 1) {
            const message = chat[i];
            if (!message || message.is_system || message.is_user || !textOf(message)) continue;
            const entry = { index:i, message, text:textOf(message) };
            if (isStoppedPartial(entry)) continue;
            return entry;
        }
        return null;
    }

    function assistantBeforeLatestUser() {
        const chat = ctx()?.chat;
        if (!Array.isArray(chat)) return null;
        let latestUser = -1;
        for (let i = chat.length - 1; i >= 0; i -= 1) {
            const message = chat[i];
            if (!message || message.is_system || !textOf(message)) continue;
            if (message.is_user) { latestUser = i; break; }
        }
        if (latestUser < 0) return latestSafeAssistant();
        return latestSafeAssistant({ beforeIndex: latestUser });
    }

    function markStoppedPartials(baseAnchor = runtime.generationStartAnchor) {
        const base = looseEntryFromAnchor(baseAnchor);
        if (!base) return 0;
        const chat = Array.isArray(ctx()?.chat) ? ctx().chat : [];
        let count = 0;
        for (let i = Number(base.index) + 1; i < chat.length; i += 1) {
            const message = chat[i];
            if (!message || message.is_system || message.is_user || !textOf(message)) continue;
            const entry = { index:i, message, text:textOf(message) };
            runtime.stoppedPartialFingerprints.add(entryFingerprint(entry));
            count += 1;
        }
        return count;
    }

    function recoverableAnchorEntry() {
        // P22: không để lastSettledAnchor cũ giành quyền ưu tiên nữa.
        // Cấu trúc của cuộc trò chuyện hiện tại mới là sự thật: dò ngược từ cuối để tìm câu trả lời AI gần nhất “không phải nửa chừng bị ngắt”.
        return latestSafeAssistant()
            || looseEntryFromAnchor(runtime.stopRecoveryAnchor)
            || looseEntryFromAnchor(runtime.generationStartAnchor)
            || looseEntryFromAnchor(runtime.lastSettledAnchor);
    }

    function commandEntry() {
        // Sau khi mở bảng, nếu người dùng xóa/tính lại tầng thì toàn bộ index có thể xê dịch.
        // commandAnchor bắt buộc phải kiểm tra hash; nếu lệch thì lấy lại câu trả lời AI hoàn chỉnh mới nhất theo cấu trúc chat hiện tại, tuyệt đối không được “trỏ lệch sang tầng cũ”.
        const anchored = strictEntryFromAnchor(runtime.commandAnchor);
        if (anchored && !isStoppedPartial(anchored)) return anchored;
        const fresh = entryForDock() || latestSafeAssistant();
        if (fresh) runtime.commandAnchor = anchorFromEntry(fresh);
        return fresh;
    }


    function latestRealMessage() {
        const chat = ctx()?.chat;
        if (!Array.isArray(chat)) return null;
        for (let i = chat.length - 1; i >= 0; i -= 1) {
            const message = chat[i];
            if (!message || message.is_system || !textOf(message)) continue;
            return { index:i, message, text:textOf(message) };
        }
        return null;
    }

    function clearGenerationWatch() {
        runtime.generationWatchToken += 1;
        clearTimeout(runtime.generationWatchTimer);
        runtime.generationWatchTimer = 0;
    }

    function startGenerationStopWatch() {
        clearGenerationWatch();
        const token = runtime.generationWatchToken;
        const startedAt = Date.now();
        const watch = async () => {
            if (token !== runtime.generationWatchToken) return;
            if (chatKeyNow() !== runtime.generationStartAnchor?.chatKey) return clearGenerationWatch();
            const last = latestRealMessage();
            let generating = true;
            try { generating = await isGenerating(); } catch {}
            // P22: khi sinh nội dung theo luồng, phần “assistant dở dang” được ghi vào chat rất sớm, nên không thể vừa thấy assistant là tắt watchdog.
            // Chừng nào SillyTavern còn báo đang sinh nội dung thì tiếp tục theo dõi.
            if (generating) {
                if (Date.now() - startedAt > 10 * 60 * 1000) return clearGenerationWatch();
                runtime.generationWatchTimer = setTimeout(watch, 420);
                return;
            }
            // Đã ngừng sinh mà tin cuối vẫn là user: rõ ràng không có kết quả AI hoàn chỉnh.
            if (Date.now() - startedAt > 600 && last?.message?.is_user) {
                restoreAfterGenerationStopped({ source:'watchdog-empty' });
                return clearGenerationWatch();
            }
            if (Date.now() - startedAt > 10 * 60 * 1000) return clearGenerationWatch();
            runtime.generationWatchTimer = setTimeout(watch, 420);
        };
        runtime.generationWatchTimer = setTimeout(watch, 700);
    }

    function loadSettings() {
        const c = ctx();
        if (!c) return;
        c.extensionSettings ||= {};
        const legacy = LEGACY_IDS.map(key => c.extensionSettings[key]).find(value => value && typeof value === 'object') || {};
        runtime.settings = { ...defaults, ...legacy, ...(c.extensionSettings[ID] || {}) };
        runtime.settings.recentFloors = [8, 12, 16, 24, 32].includes(Number(runtime.settings.recentFloors)) ? Number(runtime.settings.recentFloors) : 16;
        runtime.settings.relayPerspective = Object.hasOwn(PERSPECTIVES, String(runtime.settings.relayPerspective || '')) ? String(runtime.settings.relayPerspective) : 'first';
        runtime.settings.fateInterval = [4,6,8,10,12,16,20].includes(Number(runtime.settings.fateInterval)) ? Number(runtime.settings.fateInterval) : 8;
        runtime.settings.fateCooldown = Math.max(0, Math.min(12, Number(runtime.settings.fateCooldown ?? 4)));
        runtime.settings.directorMainEnabled = runtime.settings.directorMainEnabled !== false;
        runtime.settings.directorRelayEnabled = runtime.settings.directorRelayEnabled !== false;
        runtime.settings.fateCategories = Array.isArray(runtime.settings.fateCategories) && runtime.settings.fateCategories.length
            ? runtime.settings.fateCategories.filter(key => Object.hasOwn(FATE_CATEGORY_LABELS, key))
            : [...defaults.fateCategories];
        runtime.settings.fateHistory = Array.isArray(runtime.settings.fateHistory) ? runtime.settings.fateHistory.slice(-24) : [];
        // P33: dọn các thẻ định mệnh còn sót lại giữa các lượt từ P31/P32; mỗi lá bài chỉ dùng một lần trong giai đoạn sinh nội dung tiếp sức của user.
        const clearedLegacyPendingFate = Boolean(runtime.settings.pendingFateCard);
        runtime.settings.pendingFateCard = null;
        runtime.settings.ledgerTimed = Array.isArray(runtime.settings.ledgerTimed) ? runtime.settings.ledgerTimed
            .map(item => ({ text:String(item?.text || '').trim().slice(0,500), expiresFloor:Number(item?.expiresFloor || 0) }))
            .filter(item => item.text && Number.isFinite(item.expiresFloor)) : [];
        // Tiếp sức AI luôn dùng API riêng của nó và phần tư liệu hữu hạn do chính mô-đun này cung cấp.
        const applyDualIndependentMigration = runtime.settings.mode !== 'independent' || !runtime.settings.u1710DualIndependentApiApplied;
        runtime.settings.mode = 'independent';
        runtime.settings.u1710DualIndependentApiApplied = true;
        // P23: Tiếp sức cốt truyện bằng AI quay về chế độ ổn định dùng đúng một API.
        // Kể cả khi bản cũ từng lưu multiFlashEnabled=true thì vẫn ép di trú về false.
        const applyP23SingleMigration = !runtime.settings.p23SingleApiMigrationApplied;
        runtime.settings.multiFlashEnabled = false;
        runtime.settings.p23SingleApiMigrationApplied = true;
        c.extensionSettings[ID] = runtime.settings;
        if (applyDualIndependentMigration || applyP23SingleMigration || clearedLegacyPendingFate) c.saveSettingsDebounced?.();
    }

    function saveSettings() {
        const c = ctx();
        if (!c) return;
        c.extensionSettings ||= {};
        c.extensionSettings[ID] = runtime.settings;
        c.saveSettingsDebounced?.();
    }

    function toast(message, type = 'info') {
        const t = globalThis.toastr;
        if (t?.[type]) t[type](message, '0-32 · Tiếp sức cốt truyện bằng AI');
        else console.log(`[${ID}] ${message}`);
    }

    async function isGenerating() {
        try {
            const mod = await import('/script.js');
            if (typeof mod.isGenerating === 'function') return Boolean(mod.isGenerating());
            if (typeof mod.isGenerating === 'boolean') return mod.isGenerating;
        } catch {}
        return false;
    }


    function removeBars() {
        // P19: không đặt lối vào Tiếp sức AI trong tầng chính văn nữa. Tàn dư của bản cũ được dọn thống nhất.
        document.querySelectorAll('.vvv-relay-bar').forEach(node => node.remove());
    }

    function dockButton() {
        return document.getElementById('vvv-relay-dock-button');
    }

    function findSendButton() {
        const selectors = [
            '#send_but',
            '#send_button',
            'button#send_but',
            '[data-testid="send-button"]',
            '.send_but',
        ];
        return selectors.map(selector => document.querySelector(selector)).find(Boolean) || null;
    }

    function setDockBusy(busy) {
        runtime.dockBusy = Boolean(busy);
        const button = dockButton();
        if (!button) return;
        button.disabled = runtime.dockBusy;
        button.classList.toggle('is-busy', runtime.dockBusy);
        button.setAttribute('aria-busy', runtime.dockBusy ? 'true' : 'false');
        button.title = runtime.dockBusy
            ? '0-32 Tiếp sức: chính văn đang được sinh'
            : '0-32 · Tiếp sức cốt truyện bằng AI';
    }

    function entryForDock() {
        // P22: nút tiếp sức trên thanh gửi luôn chọn mốc neo theo “trạng thái cuối cùng thực tế của cuộc trò chuyện”.
        // 1) Có câu trả lời AI hoàn chỉnh mới nhất -> bắt buộc dùng nó;
        // 2) Tin cuối là user thật -> dùng câu trả lời AI hoàn chỉnh gần nhất trước đó;
        // 3) Phần AI dở dang do bị ngắt -> đánh dấu fingerprint rồi bỏ qua;
        // Tuyệt đối không vì runtime.generationStartAnchor còn sót mà lùi về tầng cũ.
        const chat = Array.isArray(ctx()?.chat) ? ctx().chat : [];
        for (let i = chat.length - 1; i >= 0; i -= 1) {
            const message = chat[i];
            if (!message || message.is_system || !textOf(message)) continue;
            if (message.is_user) return latestSafeAssistant({ beforeIndex:i });
            const entry = { index:i, message, text:textOf(message) };
            if (isStoppedPartial(entry)) continue;
            return entry;
        }
        return recoverableAnchorEntry();
    }

    async function openDockRelay() {
        if (!runtime.settings?.enabled) return;
        if (await isGenerating()) {
            setDockBusy(true);
            toast('Chính văn của lượt trước vẫn đang được sinh, hãy đợi lượt này xong đã.', 'info');
            return;
        }
        setDockBusy(false);
        const entry = entryForDock();
        if (!entry) {
            toast('Hiện chưa có chính văn AI hoàn chỉnh nào để tiếp sức.', 'info');
            return;
        }
        runtime.commandAnchor = anchorFromEntry(entry);
        openCommandPanel(entry).catch(showError);
    }

    function ensureDockButton() {
        removeBars();
        if (!runtime.settings?.enabled) {
            dockButton()?.remove();
            return null;
        }

        const sendButton = findSendButton();
        if (!sendButton?.parentNode) return null;

        let button = dockButton();
        if (button && button.parentNode === sendButton.parentNode) {
            // Đảm bảo luôn nằm sát bên trái nút gửi gốc.
            if (button.nextSibling !== sendButton) sendButton.parentNode.insertBefore(button, sendButton);
            setDockBusy(runtime.dockBusy);
            return button;
        }
        button?.remove();

        button = document.createElement('button');
        button.type = 'button';
        button.id = 'vvv-relay-dock-button';
        button.className = 'vvv-relay-dock-button';
        button.setAttribute('aria-label', 'Mở Tiếp sức cốt truyện bằng AI của 0-32');
        button.innerHTML = `<span class="vvv-relay-dock-glyph" aria-hidden="true">✒</span><span class="vvv-relay-dock-dot" aria-hidden="true"></span>`;
        button.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            openDockRelay().catch(showError);
        });

        sendButton.parentNode.insertBefore(button, sendButton);
        setDockBusy(runtime.dockBusy);
        return button;
    }

    function scheduleBarRestore(delay = 120) {
        // Giữ tên hàm cũ để tương thích với các lời gọi nội bộ; thứ P19 khôi phục là nút trên thanh gửi.
        clearTimeout(runtime.restoreTimer);
        runtime.restoreTimer = setTimeout(() => {
            runtime.restoreTimer = 0;
            ensureDockButton();
        }, Math.max(0, Number(delay) || 0));
    }

    function restoreBar({ settled = false, entryOverride = null, force = false } = {}) {
        removeBars();
        if (!runtime.settings?.enabled) {
            runtime.barDesired = false;
            dockButton()?.remove();
            return;
        }
        const entry = entryOverride || entryForDock();
        if (entry) {
            runtime.currentSignature = signature(entry);
            runtime.barDesired = true;
            if (settled) rememberSettledAnchor(entry);
        } else {
            runtime.currentSignature = '';
            runtime.barDesired = false;
        }
        ensureDockButton();
        if (force || settled) setDockBusy(false);
    }

    function installBarObserver() {
        // Giữ tên nội bộ cũ. Giờ theo dõi xem thanh gửi có bị chủ đề/bản di động dựng lại không.
        runtime.domObserver?.disconnect?.();
        if (typeof MutationObserver === 'undefined') return;
        const host = document.querySelector('#send_form')?.parentElement
            || document.querySelector('#send_form')
            || document.body;
        if (!host) return;
        runtime.domObserver = new MutationObserver(() => {
            clearTimeout(runtime.dockMountTimer);
            runtime.dockMountTimer = setTimeout(() => ensureDockButton(), 80);
        });
        runtime.domObserver.observe(host, { childList:true, subtree:true });
        ensureDockButton();
    }


    function commandPanel() { return document.getElementById('vvv-relay-command'); }

    function selectedDirectionLabels() {
        return [...runtime.selected]
            .map(id => DIRECTIONS.find(item => item[0] === id)?.[1])
            .filter(Boolean);
    }

    function relayPerspectiveKey() {
        const key = String(runtime.settings?.relayPerspective || 'first');
        return Object.hasOwn(PERSPECTIVES, key) ? key : 'first';
    }

    function relayPerspectiveMeta() {
        return PERSPECTIVES[relayPerspectiveKey()] || PERSPECTIVES.first;
    }

    function relayPerspectiveInstruction() {
        const key = relayPerspectiveKey();
        const meta = relayPerspectiveMeta();
        const userName = String(ctx()?.name1 || 'user').trim() || 'user';
        if (key === 'third') {
            return `${meta.instruction} Tên nhân vật user hiện tại là “${userName}”; chủ ngữ của hành động trong chính văn nên viết thẳng là “${userName}”, đừng nhầm char/NPC thành user.`;
        }
        return meta.instruction;
    }

    function renderRelayPerspective(root = commandPanel()) {
        if (!root) return;
        const active = relayPerspectiveKey();
        root.querySelectorAll('[data-relay-perspective]').forEach(button => {
            const selected = button.dataset.relayPerspective === active;
            button.classList.toggle('selected', selected);
            button.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });
        const hint = root.querySelector('[data-relay-perspective-hint]');
        if (hint) hint.textContent = `${relayPerspectiveMeta().label} · ${relayPerspectiveMeta().short}`;
    }

    function relayModeLabel() {
        return 'API riêng · tư liệu cốt truyện hữu hạn';
    }

    function currentFloorIndex() {
        const chat = ctx()?.chat;
        return Array.isArray(chat) ? Math.max(0, chat.length - 1) : 0;
    }

    function ruleLines(value) {
        return String(value || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(0, 80);
    }

    function activeLedgerRules() {
        const floor = currentFloorIndex();
        const timed = (runtime.settings?.ledgerTimed || []).filter(item => Number(item.expiresFloor) > floor && String(item.text || '').trim());
        // Tiện thể dọn các quy tắc đã hết hạn, tránh để quy tắc cũ nằm lại vĩnh viễn trong phần cài đặt.
        if (runtime.settings && timed.length !== (runtime.settings.ledgerTimed || []).length) {
            runtime.settings.ledgerTimed = timed;
            saveSettings();
        }
        return {
            long: ruleLines(runtime.settings?.ledgerLong),
            chapter: ruleLines(runtime.settings?.ledgerChapter),
            timed: timed.map(item => ({ ...item, remaining: Math.max(0, Number(item.expiresFloor) - floor) })),
        };
    }

    function activeLedgerRuleCount() {
        const rules = activeLedgerRules();
        return rules.long.length + rules.chapter.length + rules.timed.length;
    }

    function customFateCards() {
        return String(runtime.settings?.customFateCards || '').split(/\r?\n/).map((line, index) => {
            const raw = line.trim();
            if (!raw) return null;
            const split = raw.split('|').map(v => v.trim());
            const category = Object.hasOwn(FATE_CATEGORY_LABELS, split[0]) ? split.shift() : 'custom';
            const text = split.join('|').trim() || raw;
            return { id:`custom-${hash(`${index}:${raw}`)}`, category, text:text.slice(0,500), weight:1 };
        }).filter(Boolean).slice(0, 200);
    }

    function fatePool() {
        const enabled = new Set(runtime.settings?.fateCategories || defaults.fateCategories);
        return [...BUILTIN_FATE_CARDS, ...customFateCards()].filter(card => card.category === 'custom' || enabled.has(card.category));
    }

    function weightedPick(cards) {
        const total = cards.reduce((sum, card) => sum + Math.max(.01, Number(card.weight || 1)), 0);
        let roll = Math.random() * total;
        for (const card of cards) {
            roll -= Math.max(.01, Number(card.weight || 1));
            if (roll <= 0) return card;
        }
        return cards.at(-1) || null;
    }

    function drawFateCard({ manual = false } = {}) {
        if (!runtime.settings?.fateEnabled) return null;
        const pool = fatePool();
        if (!pool.length) return null;
        const cooldown = Math.max(0, Number(runtime.settings.fateCooldown || 0));
        const recent = new Set((runtime.settings.fateHistory || []).slice(-cooldown));
        const eligible = pool.filter(card => !recent.has(card.id));
        const card = weightedPick(eligible.length ? eligible : pool);
        if (!card) return null;
        runtime.currentFateCard = { ...card, drawnAtFloor:currentFloorIndex(), manual:Boolean(manual) };
        runtime.settings.fateHistory = [...(runtime.settings.fateHistory || []), card.id].slice(-24);
        saveSettings();
        return runtime.currentFateCard;
    }

    function assistantTurnCount() {
        const chat = ctx()?.chat;
        if (!Array.isArray(chat)) return 0;
        return chat.filter(message => message && !message.is_system && !message.is_user && textOf(message)).length;
    }

    function maybeAutoFate(entry) {
        if (!runtime.settings?.fateEnabled || !runtime.settings?.fateAutoEnabled || runtime.currentFateCard) return runtime.currentFateCard;
        const interval = Math.max(1, Number(runtime.settings.fateInterval || 8));
        const turns = assistantTurnCount();
        const sig = signature(entry);
        if (!turns || turns % interval !== 0 || runtime.fateLastAutoSignature === sig) return null;
        runtime.fateLastAutoSignature = sig;
        return drawFateCard({ manual:false });
    }

    function directorAppliesToRelay() {
        return runtime.settings?.directorEnabled !== false && runtime.settings?.directorRelayEnabled !== false;
    }

    function directorAppliesToMain() {
        return runtime.settings?.directorEnabled !== false && runtime.settings?.directorMainEnabled !== false;
    }

    function controlLayerSnapshot(entry) {
        const ledger = activeLedgerRules();
        const fate = runtime.currentFateCard || maybeAutoFate(entry);
        return {
            directorEnabled: runtime.settings?.directorEnabled !== false,
            fourFlashEnabled: false,
            ledger,
            fateCard: fate ? { id:fate.id, category:fate.category, categoryLabel:FATE_CATEGORY_LABELS[fate.category] || fate.category, text:fate.text } : null,
        };
    }

    function controlStatusText() {
        const bits = [];
        if (runtime.settings?.directorEnabled === false) bits.push('Đạo diễn TẮT');
        else {
            const scopes = [];
            if (directorAppliesToMain()) scopes.push('AI chính');
            if (directorAppliesToRelay()) scopes.push('Tiếp sức');
            bits.push(scopes.length ? `Đạo diễn BẬT·${scopes.join('+')}` : 'Đạo diễn BẬT·chưa chọn phạm vi');
        }
        bits.push(runtime.settings?.fateEnabled === false ? 'Bể thẻ TẮT' : `Bể thẻ BẬT${runtime.settings?.fateAutoEnabled ? '·tự động' : ''}`);
        bits.push(`Sổ cái ${activeLedgerRuleCount()}`);
        bits.push('API riêng cho tiếp sức');
        return bits.join(' · ');
    }

    function fateCardLabel(card = runtime.currentFateCard) {
        if (!card) return 'Chưa rút thẻ định mệnh';
        return `【${FATE_CATEGORY_LABELS[card.category] || card.category}】${card.text}`;
    }

    function refreshControlUi(root = commandPanel()) {
        if (!root) return;
        const status = root.querySelector('[data-control-status]');
        if (status) status.textContent = controlStatusText();
        const fate = root.querySelector('[data-fate-card]');
        if (fate) fate.textContent = fateCardLabel();
        const draw = root.querySelector('[data-fate-draw]');
        if (draw) draw.hidden = runtime.settings?.fateEnabled === false;
    }

    function renderCommandSelection(root) {
        if (!root) return;
        root.querySelectorAll('[data-relay-direction]').forEach(button => {
            button.classList.toggle('selected', runtime.selected.has(button.dataset.relayDirection));
        });
        const custom = root.querySelector('[data-relay-custom-wrap]');
        const customSelected = runtime.selected.has('custom');
        if (custom) custom.hidden = !customSelected;
        const summary = root.querySelector('[data-relay-selection-summary]');
        if (summary) {
            const labels = selectedDirectionLabels().filter(label => label !== 'Tùy chỉnh');
            summary.textContent = labels.length ? `Đã chọn: ${labels.join(' · ')}` : 'Không chọn hướng nào thì sẽ sinh theo “Tiến triển tự nhiên”';
        }
    }

    function releaseCommandViewport() {
        try { runtime.commandViewportCleanup?.(); } catch {}
        runtime.commandViewportCleanup = null;
    }

    function bindCommandViewport(root) {
        const shell = root?.querySelector('.vvv-relay-command-shell');
        if (!root || !shell) return;

        releaseCommandViewport();

        // Desktop keeps the original CSS positioning.
        // Mobile Safari / WeChat WebView use the *visual* viewport explicitly so the
        // relay panel is centered in the area the user can actually see, not the
        // larger layout viewport hidden behind browser chrome.
        const mobile = globalThis.matchMedia?.('(max-width: 760px)')?.matches;
        if (!mobile) {
            try { shell.focus({ preventScroll: true }); } catch {}
            shell.scrollTop = 0;
            return;
        }

        const vv = globalThis.visualViewport;
        let raf = 0;
        let initial = true;

        const apply = () => {
            if (!root.isConnected) return;
            const width = Math.max(1, Math.round(vv?.width || globalThis.innerWidth || document.documentElement.clientWidth || 390));
            const height = Math.max(1, Math.round(vv?.height || globalThis.innerHeight || document.documentElement.clientHeight || 700));
            const left = Math.round(vv?.offsetLeft || 0);
            const top = Math.round(vv?.offsetTop || 0);

            root.style.setProperty('inset', 'auto', 'important');
            root.style.setProperty('left', `${left}px`, 'important');
            root.style.setProperty('top', `${top}px`, 'important');
            root.style.setProperty('width', `${width}px`, 'important');
            root.style.setProperty('height', `${height}px`, 'important');
            root.style.setProperty('display', 'flex', 'important');
            root.style.setProperty('align-items', 'center', 'important');
            root.style.setProperty('justify-content', 'center', 'important');
            root.style.setProperty('box-sizing', 'border-box', 'important');

            // Keep enough air above/below the card; long content scrolls inside it.
            shell.style.setProperty('max-height', `${Math.max(360, Math.floor(height * 0.82))}px`, 'important');
            shell.style.setProperty('overflow-y', 'auto', 'important');
            shell.style.setProperty('-webkit-overflow-scrolling', 'touch');

            if (initial) {
                shell.scrollTop = 0;
                initial = false;
            }
        };

        const queueApply = () => {
            if (raf) cancelAnimationFrame(raf);
            raf = requestAnimationFrame(apply);
        };

        apply();
        requestAnimationFrame(() => {
            apply();
            shell.scrollTop = 0;
            try { shell.focus({ preventScroll: true }); } catch {}
        });

        vv?.addEventListener?.('resize', queueApply);
        vv?.addEventListener?.('scroll', queueApply);
        globalThis.addEventListener?.('orientationchange', queueApply);

        runtime.commandViewportCleanup = () => {
            if (raf) cancelAnimationFrame(raf);
            vv?.removeEventListener?.('resize', queueApply);
            vv?.removeEventListener?.('scroll', queueApply);
            globalThis.removeEventListener?.('orientationchange', queueApply);
        };
    }


    function releaseSettingsViewport() {
        try { runtime.settingsViewportCleanup?.(); } catch {}
        runtime.settingsViewportCleanup = null;
    }

    function bindSettingsViewport(root) {
        const shell = root?.querySelector(':scope > section');
        if (!root || !shell) return;

        releaseSettingsViewport();

        const mobile = globalThis.matchMedia?.('(max-width: 760px)')?.matches;
        if (!mobile) {
            shell.scrollTop = 0;
            return;
        }

        const vv = globalThis.visualViewport;
        let raf = 0;
        let initial = true;

        const apply = () => {
            if (!root.isConnected) return;

            const width = Math.max(
                1,
                Math.round(vv?.width || globalThis.innerWidth || document.documentElement.clientWidth || 390),
            );
            const height = Math.max(
                1,
                Math.round(vv?.height || globalThis.innerHeight || document.documentElement.clientHeight || 700),
            );
            const left = Math.round(vv?.offsetLeft || 0);
            const top = Math.round(vv?.offsetTop || 0);

            // Dùng đúng cách định vị VisualViewport như cửa sổ tiếp sức chính đã được kiểm chứng.
            root.style.setProperty('inset', 'auto', 'important');
            root.style.setProperty('left', `${left}px`, 'important');
            root.style.setProperty('top', `${top}px`, 'important');
            root.style.setProperty('width', `${width}px`, 'important');
            root.style.setProperty('height', `${height}px`, 'important');
            root.style.setProperty('display', 'flex', 'important');
            root.style.setProperty('align-items', 'center', 'important');
            root.style.setProperty('justify-content', 'center', 'important');
            root.style.setProperty('box-sizing', 'border-box', 'important');

            // Trang cài đặt dài hơn cửa sổ tiếp sức chính, nên giới hạn trong chiều cao thực sự nhìn thấy và cho phép cuộn bên trong.
            shell.style.setProperty('max-height', `${Math.max(360, Math.floor(height * 0.84))}px`, 'important');
            shell.style.setProperty('overflow-x', 'hidden', 'important');
            shell.style.setProperty('overflow-y', 'auto', 'important');
            shell.style.setProperty('-webkit-overflow-scrolling', 'touch');

            if (initial) {
                shell.scrollTop = 0;
                initial = false;
            }
        };

        const queueApply = () => {
            if (raf) cancelAnimationFrame(raf);
            raf = requestAnimationFrame(apply);
        };

        apply();
        requestAnimationFrame(() => {
            apply();
            shell.scrollTop = 0;
        });

        vv?.addEventListener?.('resize', queueApply);
        vv?.addEventListener?.('scroll', queueApply);
        globalThis.addEventListener?.('orientationchange', queueApply);

        runtime.settingsViewportCleanup = () => {
            if (raf) cancelAnimationFrame(raf);
            vv?.removeEventListener?.('resize', queueApply);
            vv?.removeEventListener?.('scroll', queueApply);
            globalThis.removeEventListener?.('orientationchange', queueApply);
        };
    }

    function releasePreviewViewport() {
        try { runtime.previewViewportCleanup?.(); } catch {}
        runtime.previewViewportCleanup = null;
    }

    function bindPreviewViewport(root) {
        const shell = root?.querySelector(':scope > section');
        const textarea = root?.querySelector('textarea');
        if (!root || !shell) return;

        releasePreviewViewport();
        const mobile = globalThis.matchMedia?.('(max-width: 760px)')?.matches;
        if (!mobile) {
            shell.scrollTop = 0;
            try { textarea?.focus({ preventScroll: true }); } catch {}
            return;
        }

        // P36: iPhone / WebView của WeChat bắt buộc phải bám theo visualViewport.
        // Không chủ động focus vào textarea, tránh việc bàn phím/trình duyệt cuộn cả hộp thoại fixed lên đỉnh màn hình chỉ để lấy tiêu điểm.
        try { textarea?.blur(); } catch {}
        const vv = globalThis.visualViewport;
        let raf = 0;
        let initial = true;

        const apply = () => {
            if (!root.isConnected) return;
            const width = Math.max(1, Math.round(vv?.width || globalThis.innerWidth || document.documentElement.clientWidth || 390));
            const height = Math.max(1, Math.round(vv?.height || globalThis.innerHeight || document.documentElement.clientHeight || 700));
            const left = Math.round(vv?.offsetLeft || 0);
            const top = Math.round(vv?.offsetTop || 0);

            root.style.setProperty('position', 'fixed', 'important');
            root.style.setProperty('inset', 'auto', 'important');
            root.style.setProperty('left', `${left}px`, 'important');
            root.style.setProperty('top', `${top}px`, 'important');
            root.style.setProperty('width', `${width}px`, 'important');
            root.style.setProperty('height', `${height}px`, 'important');
            root.style.setProperty('display', 'flex', 'important');
            root.style.setProperty('align-items', 'center', 'important');
            root.style.setProperty('justify-content', 'center', 'important');
            root.style.setProperty('box-sizing', 'border-box', 'important');
            root.style.setProperty('overflow', 'hidden', 'important');

            shell.style.setProperty('width', 'calc(100% - 24px)', 'important');
            shell.style.setProperty('max-width', '660px', 'important');
            shell.style.setProperty('max-height', `${Math.max(320, Math.floor(height * 0.78))}px`, 'important');
            shell.style.setProperty('overflow-x', 'hidden', 'important');
            shell.style.setProperty('overflow-y', 'auto', 'important');
            shell.style.setProperty('-webkit-overflow-scrolling', 'touch');
            shell.style.setProperty('overscroll-behavior', 'contain');
            shell.style.setProperty('margin', '0', 'important');

            if (initial) {
                shell.scrollTop = 0;
                initial = false;
            }
        };

        const queueApply = () => {
            if (raf) cancelAnimationFrame(raf);
            raf = requestAnimationFrame(apply);
        };

        apply();
        requestAnimationFrame(() => { apply(); shell.scrollTop = 0; });
        vv?.addEventListener?.('resize', queueApply);
        vv?.addEventListener?.('scroll', queueApply);
        globalThis.addEventListener?.('orientationchange', queueApply);

        runtime.previewViewportCleanup = () => {
            if (raf) cancelAnimationFrame(raf);
            vv?.removeEventListener?.('resize', queueApply);
            vv?.removeEventListener?.('scroll', queueApply);
            globalThis.removeEventListener?.('orientationchange', queueApply);
        };
    }

    function closePreview(root = preview()) {
        releasePreviewViewport();
        root?.remove();
        runtime.draftAnchor=null;
        runtime.previewCustom='';
    }

    function closeSettingsModal(root = settingsModal()) {
        releaseSettingsViewport();
        root?.remove();
    }

    function closeCommandPanel() {
        releaseCommandViewport();
        commandPanel()?.remove();
        runtime.panelOpen = false;
    }

    async function openCommandPanel(entryOverride = null) {
        globalThis.VVVUnifiedCore?.overlays?.activate?.('relay');
        removeLegacyPerspectiveStyle();
        if (await isGenerating()) throw new Error('Chính văn của lượt trước vẫn đang được sinh, hãy đợi xong rồi mới tiếp sức');
        const entry = entryOverride || entryForDock() || latestSafeAssistant();
        if (!entry) throw new Error('Hiện chưa có chính văn AI nào để tiếp sức');
        runtime.commandAnchor = anchorFromEntry(entry);
        closeCommandPanel();
        runtime.lastError='';

        const root = document.createElement('div');
        root.id = 'vvv-relay-command';
        const cards = DIRECTIONS.map(([id, label]) => `<button type="button" class="vvv-relay-choice" data-relay-direction="${id}">
            <span class="vvv-relay-choice-icon">${esc(DIRECTION_ICONS[id] || '•')}</span>
            <span class="vvv-relay-choice-text">${esc(label)}</span>
            <span class="vvv-relay-choice-check">✓</span>
        </button>`).join('');
        root.innerHTML = `<div class="vvv-relay-backdrop" data-relay-panel-close></div>
            <section class="vvv-relay-command-shell" role="dialog" aria-modal="true" aria-label="0-32 Tiếp sức cốt truyện bằng AI" tabindex="-1">
                <div class="vvv-relay-command-glow"></div>
                <header class="vvv-relay-command-head">
                    <div>
                        <div class="vvv-relay-kicker"><span>✦</span> 0-32 STORY RELAY</div>
                        <h2>Bước tiếp theo, bạn quyết định</h2>
                        <p>AI chỉ viết bước nhỏ kế tiếp thay cho <b>user</b>. Khóa liền mạch cốt truyện đang bật, sẽ không tự dưng nhảy thời gian, đổi địa điểm hay quyết thay NPC.</p>
                    </div>
                    <div class="vvv-relay-command-tools">
                        <button type="button" class="vvv-relay-iconbtn" data-relay-panel-settings title="Cài đặt tiếp sức" aria-label="Cài đặt tiếp sức">⚙</button>
                        <button type="button" class="vvv-relay-iconbtn" data-relay-panel-close title="Đóng" aria-label="Đóng">×</button>
                    </div>
                </header>
                <div class="vvv-relay-status-strip">
                    <span><i class="vvv-relay-dot"></i>Khóa liền mạch <b>BẬT</b></span>
                    <span>Mốc neo tiếp sức <b>#${Number(entry.index)}</b></span>
                    <span>Ngữ cảnh <b>${normalizedRecentFloorCount()} tầng gần nhất + ký ức R9</b></span>
                    <span>Nguồn viết <b>${esc(relayModeLabel())}</b></span>
                    <span>Văn phong <b>kể thẳng · không ẩn dụ</b></span>
                </div>
                ${(() => { const rf=deriveRelayRealityFacts(entry); return rf.hardFacts.length ? `<div class="vvv-relay-reality-lock"><b>⛓ Khóa hiện thực hiện tại</b>${rf.hardFacts.map(x=>`<span>${esc(x)}</span>`).join('')}</div>` : ''; })()}
                <div class="vvv-relay-command-body">
                    <div class="vvv-relay-section-title"><div><b>Chọn hướng đẩy tới</b><small>Chọn được nhiều mục; mặc định chỉ đẩy một nhịp nhỏ của cảnh hiện tại</small></div><span>STEP 01</span></div>
                    <div class="vvv-relay-choice-grid">${cards}</div>
                    <div class="vvv-relay-control-box">
                        <div><b>✒️ Lớp điều khiển 0-32</b><small>Đạo diễn / Điều phối / Bể thẻ định mệnh / Sổ cái quy tắc</small></div>
                        <button type="button" data-fate-draw>🎴 Rút một thẻ định mệnh</button>
                        <p data-fate-card>${esc(fateCardLabel())}</p>
                    </div>
                    <div class="vvv-relay-perspective-box">
                        <div class="vvv-relay-perspective-head">
                            <div><b>Viết theo ngôi kể nào</b><small>Chỉ chi phối ngôi kể của lượt tiếp sức này; chọn một trong ba và ghi nhớ lựa chọn lần trước</small></div>
                            <span data-relay-perspective-hint>${esc(relayPerspectiveMeta().label)} · ${esc(relayPerspectiveMeta().short)}</span>
                        </div>
                        <div class="vvv-relay-perspective-options" role="group" aria-label="Ngôi kể">
                            ${Object.entries(PERSPECTIVES).map(([key, meta]) => `<button type="button" class="vvv-relay-perspective-option" data-relay-perspective="${key}" aria-pressed="false"><i>${esc(meta.mark)}</i><span>${esc(meta.label)}</span></button>`).join('')}
                        </div>
                    </div>
                    <div class="vvv-relay-custom-panel" data-relay-custom-wrap hidden>
                        <div class="vvv-relay-section-title compact"><div><b>Lời user cần gửi đi</b><small>Viết đúng nội dung bạn thật sự muốn gửi; khi không bật mở rộng thì chỉ chỉnh câu cho gọn</small></div><span>USER TEXT</span></div>
                        <div class="vvv-relay-usertext-row">
                            <textarea maxlength="20000" data-relay-user-text placeholder="Ví dụ: Cố Lâm bước tới bên ghế cô ấy và nói, cưng đứng dậy đi…"></textarea>
                            <button type="button" class="vvv-relay-expand-toggle" data-relay-expand aria-pressed="false" title="Khi bật, AI sẽ bổ sung hành động, cảm nhận và lời thoại mà không đánh tráo ý chính; khi tắt, AI vẫn chỉnh câu ở mức nhẹ">
                                <i>✦</i><b>AI mở rộng</b><small data-relay-expand-state>Tắt · chỉ chỉnh câu</small>
                            </button>
                        </div>
                        <div class="vvv-relay-section-title compact vvv-relay-thought-title"><div><b>Bổ sung ý của bạn</b><small>Gửi kèm phần chữ của user ở trên; dùng để bổ sung hướng đi, giọng điệu hoặc chi tiết</small></div><span>OPTIONAL</span></div>
                        <textarea maxlength="1200" data-relay-custom-text placeholder="Ví dụ: giọng tự nhiên hơn chút, bắt lại chủ đề vừa nãy trước đã; nếu bật mở rộng thì thêm một chút chi tiết hành động…"></textarea>
                        <small class="vvv-relay-custom-note">Cả hai ô sẽ được đưa cho AI cùng lúc. Khi tắt “AI mở rộng” thì chỉ chỉnh câu ở mức nhẹ; khi bật thì bắt buộc viết lại thật sự và mở rộng tự nhiên, không gửi lại nguyên văn nữa.</small>
                    </div>
                </div>
                <footer class="vvv-relay-command-footer">
                    <div class="vvv-relay-footer-copy">
                        <div class="vvv-relay-selection-summary" data-relay-selection-summary>Không chọn hướng nào thì sẽ sinh theo “Tiến triển tự nhiên”</div>
                        <div class="vvv-relay-inline-error" data-relay-inline-error role="alert" hidden></div>
                    </div>
                    <div class="vvv-relay-generation-actions">
                        <button type="button" class="vvv-relay-primary" data-relay-panel-generate title="Sinh nội dung bằng API riêng của Tiếp sức AI">
                            <span>Sinh câu tiếp theo của tôi</span><i>→</i>
                        </button>
                    </div>
                </footer>
            </section>`;
        document.body.appendChild(root);
        runtime.panelOpen = true;
        root.querySelectorAll('[data-relay-panel-close]').forEach(button => button.addEventListener('click', closeCommandPanel));
        root.querySelector('[data-relay-panel-settings]')?.addEventListener('click', () => {
            closeCommandPanel();
            openSettings().catch(showError);
        });
        root.querySelector('[data-fate-draw]')?.addEventListener('click', () => {
            const card = drawFateCard({ manual:true });
            if (card) toast(`Thẻ định mệnh: ${FATE_CATEGORY_LABELS[card.category] || card.category} · ${card.text}`, 'info');
            refreshControlUi(root);
        });
        root.querySelectorAll('[data-relay-perspective]').forEach(button => button.addEventListener('click', () => {
            const key = String(button.dataset.relayPerspective || '');
            if (!Object.hasOwn(PERSPECTIVES, key)) return;
            runtime.settings.relayPerspective = key;
            saveSettings();
            renderRelayPerspective(root);
        }));
        root.querySelectorAll('[data-relay-direction]').forEach(button => button.addEventListener('click', () => {
            const id = button.dataset.relayDirection;
            if (runtime.selected.has(id)) runtime.selected.delete(id);
            else runtime.selected.add(id);
            renderCommandSelection(root);
            if (id === 'custom' && runtime.selected.has(id)) setTimeout(() => root.querySelector('[data-relay-user-text]')?.focus(), 0);
        }));
        root.querySelector('[data-relay-expand]')?.addEventListener('click', event => {
            const button=event.currentTarget;
            const pressed=button?.getAttribute('aria-pressed')==='true';
            button?.setAttribute('aria-pressed', pressed ? 'false' : 'true');
            button?.classList.toggle('selected', !pressed);
            const state=button?.querySelector('[data-relay-expand-state]');
            if(state)state.textContent=pressed?'Tắt · chỉ chỉnh câu':'Bật · mở rộng tự nhiên';
        });
        root.querySelector('[data-relay-panel-generate]')?.addEventListener('click', () => {
            const customSelected=runtime.selected.has('custom');
            const userText=customSelected ? String(root.querySelector('[data-relay-user-text]')?.value || '') : '';
            const notes=customSelected ? String(root.querySelector('[data-relay-custom-text]')?.value || '') : '';
            const expand=customSelected && root.querySelector('[data-relay-expand]')?.getAttribute('aria-pressed')==='true';
            if (customSelected && !userText.trim() && !notes.trim()) {
                const input=root.querySelector('[data-relay-user-text]');
                input?.focus();
                toast('Sau khi chọn “Tùy chỉnh”, hãy điền “Lời user cần gửi đi” hoặc “Bổ sung ý của bạn”.', 'warning');
                return;
            }
            setRelayInlineError('');
            generateDraft({userText,notes,expand}).catch(showError);
        });
        renderCommandSelection(root);
        renderRelayPerspective(root);
        bindCommandViewport(root);
        refreshControlUi(root);
    }

    function fallbackCharacterSnapshot() {
        const c = ctx();
        let fields = {};
        try { fields = c?.getCharacterCardFields?.() || {}; } catch {}
        return {
            name: c?.name2 || '',
            userName: c?.name1 || '',
            description: fields.description || '',
            personality: fields.personality || '',
            scenario: fields.scenario || '',
            firstMessage: fields.first_mes || '',
            system: fields.system || '',
            postHistory: fields.jailbreak || '',
            persona: fields.persona || '',
        };
    }

    function normalizedRecentFloorCount() {
        const value = Number(runtime.settings?.recentFloors || 16);
        return [8, 12, 16, 24, 32].includes(value) ? value : 16;
    }

    function continuityFloorCount() {
        // P24: phần nguyên văn trọng số cao mà Tiếp sức AI thật sự dùng để “viết tiếp hiện tại” chỉ giữ 6 tầng gần nhất (khoảng 3 lượt qua lại).
        // Các mức 8/12/16/24/32 cũ chỉ còn là tham chiếu cho ký ức dài hạn/truy xuất, không còn đưa nguyên văn mở màn ngang hàng với chính văn hiện tại cho mô hình nữa.
        return 6;
    }

    function isOpeningMessage(message, index = -1) {
        if (!message) return false;
        if (message.is_first_message || message.isGreeting || message?.extra?.isGreeting || message?.extra?.is_first_message) return true;
        return Number(index) === 0;
    }

    function transcript(limit = normalizedRecentFloorCount(), maxIndex = null, { excludeOpening = false } = {}) {
        const c = ctx();
        const chat = Array.isArray(c?.chat) ? c.chat : [];
        const ceiling = Number.isInteger(Number(maxIndex)) ? Number(maxIndex) : Number.POSITIVE_INFINITY;
        const real = chat.map((message, index) => ({ message, index }))
            .filter(({ message, index }) => index <= ceiling && message && !message.is_system && textOf(message))
            .filter(({ message, index }) => !(excludeOpening && ceiling >= 6 && isOpeningMessage(message, index)));
        return real.slice(-Math.max(1, Number(limit || 16))).map(({ message, index }) => ({
            floor: index,
            role: message.is_user ? 'user' : 'assistant',
            name: message.name || '',
            text: textOf(message).slice(0, 12000),
        }));
    }

    function previousUserBefore(entry) {
        const chat = Array.isArray(ctx()?.chat) ? ctx().chat : [];
        const end = Math.max(0, Number(entry?.index ?? chat.length));
        for (let i = end - 1; i >= 0; i -= 1) {
            const message = chat[i];
            if (!message || message.is_system || !textOf(message)) continue;
            if (message.is_user) return { index: i, text: textOf(message) };
        }
        return { index: -1, text: '' };
    }

    function tailText(value, maxChars = 3500) {
        const text = String(value || '').trim();
        return text.length <= maxChars ? text : text.slice(-maxChars);
    }

    function detectCompletionSignals(latestText, previousUserText = '') {
        const assistant = String(latestText || '');
        const previousUser = String(previousUserText || '');
        const text = `${previousUser}\n${assistant}`;
        const scoped = tailText(text, 9000);
        const signals = [];
        const add = (id, label, done, start) => {
            if (done.test(scoped)) signals.push({ id, label, start: start.source });
        };

        add(
            'bath',
            'Đã rời phòng tắm / giai đoạn tắm rửa đã kết thúc',
            /(?:bước ra khỏi|đi ra khỏi|rời khỏi|ra khỏi|bế ra khỏi|bế[^.!?]{0,35}(?:ra khỏi|rời khỏi))[^.!?]{0,16}(?:phòng tắm|nhà tắm|buồng tắm|nhà vệ sinh)|từ (?:phòng tắm|nhà tắm|buồng tắm|bồn tắm)[^.!?]{0,45}(?:đi ra|bước ra|bế ra)|tắm xong|tắm rửa xong|tắm gội xong|(?:tắm|gội)[^.!?]{0,10}xong rồi/i,
            /(?:bước ra khỏi|đi ra khỏi|rời khỏi|ra khỏi|bế ra khỏi|bế[^.!?]{0,35}(?:ra khỏi|rời khỏi))[^.!?]{0,16}(?:phòng tắm|nhà tắm|buồng tắm|nhà vệ sinh)|từ (?:phòng tắm|nhà tắm|buồng tắm|bồn tắm)[^.!?]{0,45}(?:đi ra|bước ra|bế ra)|(?:đi|định đi|chuẩn bị đi|vào|bước vào)[^.!?]{0,12}(?:tắm|phòng tắm|nhà tắm|nhà vệ sinh)|tắm(?: một)? cái/i
        );
        add(
            'sofa',
            'Đã tới khu ghế sofa / phòng khách và còn ở đó',
            /(?:quay về|trở về|đi tới|bước tới|chuyển tới|bế tới|đặt lên|ngồi xuống|tựa vào|quỳ lên|ép lên)[^.!?]{0,18}(?:ghế sofa|sofa|phòng khách)|(?:ngồi trên|nằm trên|tựa vào|quỳ trên|ép trên|đặt trên)[^.!?]{0,18}(?:ghế sofa|sofa)|(?:trên|cạnh|bên|đệm|lưng) (?:ghế sofa|sofa)/i,
            /(?:quay về|trở về|đi tới|bước tới|chuyển tới|bế tới|đặt lên|ngồi xuống|tựa vào|quỳ lên|ép lên)[^.!?]{0,18}(?:ghế sofa|sofa|phòng khách)|(?:bế|dắt|kéo)[^.!?]{0,28}(?:đi tới|quay về|bước tới)[^.!?]{0,18}(?:ghế sofa|sofa|phòng khách)/i
        );
        add(
            'condom',
            'Bao cao su đã bóc và đeo xong',
            /(?:bao cao su|bao|gói bạc nhỏ|vỏ bạc)[^.!?]{0,36}(?:xé ra|bóc ra|đeo xong|đeo vào|lồng vào)|(?:xé|bóc)[^.!?]{0,30}(?:bao cao su|bao|vỏ|gói bạc nhỏ)[^.!?]{0,30}(?:đeo xong|đeo vào|lồng vào)|(?:đeo xong|đeo vào|lồng vào)[^.!?]{0,24}(?:bao cao su|bao)/i,
            /(?:cầm lấy|lấy ra|móc ra|rút ra)[^.!?]{0,24}(?:bao cao su|bao|gói bạc nhỏ|vỏ bạc)|(?:xé|bóc)[^.!?]{0,24}(?:vỏ|bao cao su|bao|gói bạc nhỏ)|(?:đeo xong|đeo vào|lồng vào)[^.!?]{0,24}(?:bao cao su|bao)/i
        );
        add('meal', 'Bữa ăn đã xong', /(?:ăn (?:cơm |xong)?xong|ăn hết|dùng bữa xong|sau bữa (?:ăn|cơm)|no rồi|đặt (?:bát|đũa|chén|thìa) xuống)/i,
            /(?:đi|định đi|chuẩn bị đi|cùng|chúng ta)[^.!?]{0,12}(?:ăn cơm|ăn gì đó|dùng bữa|nhà hàng|quán ăn)|(?:ăn|kiếm) (?:chút|cái) gì/i);
        add('home', 'Đã về tới nhà / phòng riêng', /(?:đã|cuối cùng|rồi|sau đó)?[^.!?]{0,12}(?:về (?:tới|đến) nhà|về nhà rồi|bước vào cửa nhà|về (?:tới |đến )?phòng|về (?:tới |đến )?phòng ngủ|vào phòng ngủ)/i,
            /(?:về nhà|về phòng|về phòng ngủ|chuẩn bị về|đi về|về trước)/i);
        add('bed', 'Đã lên giường / nằm xuống', /(?:đã|lại|sau đó)?[^.!?]{0,10}(?:nằm trên giường|nằm xuống|lên giường rồi|chui vào chăn|trở lại giường)/i,
            /(?:lên giường|nằm lên giường|nằm xuống|chui vào chăn|trở lại giường)/i);
        add('leave', 'Đã rời khỏi địa điểm trước đó', /(?:đã|sau đó|quay người)?[^.!?]{0,12}(?:rời đi|rời khỏi|bước ra|đi ra|ra khỏi cửa|đi xa rồi)/i,
            /(?:chuẩn bị|định|đứng dậy|quay người)?[^.!?]{0,10}(?:rời đi|đi ra ngoài|ra khỏi cửa)/i);
        return signals;
    }

    function deriveRelayRealityFacts(entry) {
        const previous = previousUserBefore(entry);
        const assistant = String(entry?.text || '');
        const combined = tailText(`${previous.text}\n${assistant}`, 10000);
        const facts = [];
        const signals = detectCompletionSignals(assistant, previous.text);
        const ids = new Set(signals.map(item => item.id));

        if (ids.has('bath')) facts.push('Giai đoạn phòng tắm/tắm rửa đã kết thúc; cấm viết lại “vừa bước ra khỏi phòng tắm / vẫn còn trong phòng tắm / lại rời phòng tắm”.');
        if (ids.has('sofa')) facts.push('Tương tác hiện tại đã chuyển tới khu phòng khách/ghế sofa; ghế sofa là mốc neo của cảnh hiện tại, phòng tắm chỉ còn là quá khứ.');
        if (ids.has('condom')) facts.push('Các thao tác liên quan tới bao cao su đã hoàn tất; cấm viết lại cảnh lấy bao, bóc vỏ, xé lớp bạc hay đeo lại bao.');

        // Với những đoạn chính văn dài kiểu chụp màn hình, ở cuối có thể xuất hiện câu hồi tưởng “vừa nãy được bế ra từ phòng tắm”.
        // Chỉ cần đồng thời có “đã rời phòng tắm + vẫn đang tương tác ở ghế sofa” thì ép hạ phòng tắm xuống thành địa điểm quá khứ.
        if (ids.has('bath') && /(?:trên|cạnh|bên|đệm|lưng) (?:ghế sofa|sofa)|(?:ngồi trên|nằm trên|tựa vào|quỳ trên|ép trên|đặt trên)[^.!?]{0,18}(?:ghế sofa|sofa)/i.test(combined)) {
            facts.push('Thứ tự ưu tiên địa điểm: phòng khách/ghế sofa > phòng tắm. Kể cả khi lời thoại phía sau nhắc “vừa nãy đi ra từ phòng tắm” thì đó cũng chỉ là hồi tưởng, không phải vị trí hiện tại.');
        }
        return {
            previousUserFloor: previous.index,
            completedSignals: signals.map(item => ({ id:item.id, label:item.label })),
            hardFacts: facts,
            anchorTail: tailText(assistant, 5200),
        };
    }


    function currentTurnSnapshot(entry) {
        const previous = previousUserBefore(entry);
        const latestText = String(entry?.text || '');
        const reality = deriveRelayRealityFacts(entry);
        return {
            previousUserFloor: previous.index,
            previousUser: previous.text.slice(0, 6000),
            latestAssistantFloor: Number(entry?.index ?? -1),
            latestAssistant: latestText.slice(0, 12000),
            // P22: ngoài phần cuối chính văn, đưa thêm cho Flash bốn tầng một “danh sách sự thật đã hoàn tất”, tránh để lời hồi tưởng trong đoạn văn dài kéo trạng thái lùi lại.
            currentRealityTail: tailText(latestText, 5200),
            completedSignals: reality.completedSignals,
            hardFacts: reality.hardFacts,
        };
    }

    function buildRelayQuery(currentTurn, chosen = []) {
        return [
            '【SỰ THẬT CỨNG CỦA HIỆN THỰC HIỆN TẠI】', (currentTurn?.hardFacts || []).join('\n'),
            '【TIN NHẮN USER TRƯỚC ĐÓ】', tailText(currentTurn?.previousUser, 2200),
            '【ĐOẠN CUỐI CHÍNH VĂN AI MỚI NHẤT / HIỆN THỰC HIỆN TẠI】', tailText(currentTurn?.currentRealityTail, 3600),
            '【HƯỚNG TIẾP SỨC LẦN NÀY】', chosen.join(' + '),
            '【RÀNG BUỘC TRUY XUẤT】Những lần di chuyển địa điểm và hành động đã hoàn tất chỉ là lịch sử; đừng gợi nhớ các giai đoạn đã xong như “phòng tắm / lấy bao / đeo bao” thành nhiệm vụ hiện tại.',
        ].filter(Boolean).join('\n');
    }

    function explicitRepeatIntent(custom = '') {
        return /(?:làm lại|lần nữa|một lần nữa|lặp lại|đi lại|tắm lại|ăn lại|về lại|nằm lại|làm thêm lần nữa|lại từ đầu)/i.test(String(custom || ''));
    }

    const CUSTOM_ACTION_FAMILIES = [
        { label:'Ăn cơm/dùng bữa', request:/ăn cơm|dùng bữa|ăn gì|ăn (?:sáng|trưa|tối|khuya)|đi ăn|tìm.*ăn|nhà hàng|quán ăn|căng tin/i, output:/ăn|dùng bữa|cơm|nhà hàng|quán ăn|căng tin|gọi món|thực đơn/i },
        { label:'Ngủ/nghỉ ngơi', request:/đi ngủ|ngủ một giấc|lên giường|đi nằm|ngủ bù|nghỉ ngơi/i, output:/ngủ|lên giường|nằm|đi nằm|nghỉ/i },
        { label:'Tắm', request:/tắm|tắm rửa|tắm vòi sen|ngâm bồn/i, output:/tắm|tắm rửa|vòi sen|ngâm bồn|phòng tắm/i },
        { label:'Về nhà', request:/về nhà|về chỗ ở|về nơi ở|về căn hộ/i, output:/về nhà|chỗ ở|nơi ở|căn hộ|cửa nhà/i },
        { label:'Đi làm/công việc', request:/đi làm|tới công ty|tới cơ quan|bắt đầu làm việc|văn phòng/i, output:/đi làm|công ty|cơ quan|công việc|văn phòng/i },
        { label:'Mua sắm', request:/mua đồ|mua sắm|đi dạo phố|đi mua|đặt đơn/i, output:/mua|mua sắm|trung tâm thương mại|cửa hàng|đặt đơn|thanh toán/i },
        { label:'Gọi điện', request:/gọi điện|quay số|liên lạc qua điện thoại/i, output:/gọi điện|quay số|điện thoại|máy/i },
        { label:'Nhắn tin', request:/nhắn tin|gửi WeChat|gửi tin nhắn|liên lạc qua WeChat/i, output:/nhắn tin|WeChat|tin nhắn|gõ|gửi/i },
        { label:'Chuyển khoản/thanh toán', request:/chuyển khoản|thanh toán|trả tiền|chi trả/i, output:/chuyển khoản|thanh toán|trả tiền|chi trả|số tiền|nhận tiền/i },
        { label:'Đặt đồ ăn', request:/đặt đồ ăn|gọi đồ ăn|đặt ship đồ ăn/i, output:/giao đồ ăn|đặt đơn|món ăn|giao hàng|cửa hàng/i },
        { label:'Ôm', request:/ôm lấy|ôm chặt|ôm|khoác vai|vòng tay/i, output:/ôm lấy|ôm chặt|ôm|khoác vai|vòng tay/i },
        { label:'Hôn / xin được hôn', request:/hôn(?: một cái| một lát| chút)?|nụ hôn|hôn (?:cô ấy|anh ấy|lấy)/i, output:/hôn(?: một cái| một lát| chút)?|nụ hôn|hôn (?:cô ấy|anh ấy|lấy)/i },
    ];

    function directionHasAffirmativeMatch(pattern, value) {
        const text=String(value||'');
        const flags=pattern.flags.includes('g')?pattern.flags:`${pattern.flags}g`;
        const matcher=new RegExp(pattern.source,flags);
        for(const match of text.matchAll(matcher)){
            const clauseStart=Math.max(text.lastIndexOf(',',match.index),text.lastIndexOf('.',match.index),text.lastIndexOf(';',match.index),text.lastIndexOf('!',match.index),text.lastIndexOf('?',match.index),text.lastIndexOf(':',match.index),text.lastIndexOf('\n',match.index));
            const prefix=text.slice(clauseStart+1,match.index).trim();
            const lastIndex=(regex)=>{let index=-1;for(const item of prefix.matchAll(regex))index=item.index??index;return index;};
            const negationAt=lastIndex(/đừng|chớ|không được|cấm|không cần|khỏi cần|không còn|không đi|không muốn|từ chối|hủy/gi);
            const reversalAt=lastIndex(/nhưng|nhưng mà|thế nhưng|có điều|mà là|ngược lại|vẫn|vẫn cứ/gi);
            if(negationAt>reversalAt)continue;
            return true;
        }
        return false;
    }

    function stripParentheticalStageDirections(value = '') {
        const source=String(value||'');
        return source.replace(/[(]([^()]{1,800})[)]/g,(whole,inner)=>{
            const text=String(inner||'').trim();
            // Khi trong ngoặc có chuỗi hành động hoặc từ chỉ trình tự thì coi là chỉ dẫn sân khấu; lúc soát lời thoại không nuốt nó vào câu “bắt buộc nói nguyên văn”.
            if(/sau đó|rồi thì|tiếp đó|kế đó|ngay sau đó|(?:^|[,.;])\s*(?:tôi|anh ấy|cô ấy|mình|user|{{user}})?\s*(?:ngồi|đứng|đi|đứng dậy|nằm|cưỡi|ôm|khoác|hôn|kéo|đẩy|cầm|đặt|tựa|quay|về|rời|bước vào|đưa tay|cúi đầu|ngẩng đầu|mở cửa|đóng cửa)/i.test(text))return '.';
            return whole;
        });
    }

    function customExpressionRequirements(custom = '') {
        const source=(typeof stripParentheticalStageDirections==='function' ? stripParentheticalStageDirections(custom) : String(custom||'')).trim().slice(0,1200);
        if(!source)return [];
        const out=[],seen=new Set();
        const push=value=>{
            const cleaned=String(value||'').trim().replace(/^[\s:,.;“”"'‘’«»]+|[\s“”"'‘’«»]+$/g,'').trim();
            if(cleaned.length<4)return;
            const key=normalizeRelayEchoText(cleaned);if(key.length<4||seen.has(key))return;
            seen.add(key);out.push(cleaned.slice(0,360));
        };
        for(const match of source.matchAll(/[“«"]([^”»"]{4,360})[”»"]/g))push(match[1]);
        const cues=[...source.matchAll(/(?:cất tiếng (?:nói|hỏi)|khẽ (?:nói|hỏi)|nhỏ giọng (?:nói|hỏi)|cười (?:nói|hỏi)|bảo (?:cô ấy|anh ấy|đối phương)?|nói với (?:cô ấy|anh ấy|đối phương)|(?:tôi|mình) (?:nói|hỏi)|(?:^|[.!?;]\s*)hỏi|nói)\s*[:,.\s]*/gi)];
        for(let index=0;index<cues.length;index+=1){
            const cue=cues[index],start=(cue.index||0)+cue[0].length,end=cues[index+1]?.index??source.length;
            let speech=source.slice(start,end);
            // Khi không có dấu ngoặc kép, lấy một hành động ngôi thứ nhất rõ ràng làm ranh giới lời thoại. Không được gộp cả chuỗi hành động phía sau
            // vào một câu “bắt buộc giữ nguyên văn”, nếu không thì bản mở rộng trung thành lại chắc chắn bị chấm sai.
            const transition=speech.search(/[.!?,;]\s*(?=(?:(?:rồi thì|sau đó|tiếp đó|kế đó)\s*)?(?:(?:trước tiên|trước hết)\s*(?:đem|đi|về|bước|đóng|mở|cởi|mặc|cầm|đặt|quỳ)|tôi\s*(?:đem|đứng dậy|đi|về|đóng|kéo|cởi|mặc|cầm|đặt|quỳ|ngồi|đứng|nằm|ôm|hôn|quay|đẩy|mở|khép)|chúng (?:tôi|ta)\s*(?:lại\s*)?(?:về|đi|rời)|hai người|mọi người))/i);
            if(transition>=0)speech=speech.slice(0,transition);
            push(speech);
        }
        // Chế độ mở rộng thông thường vẫn phải nhận ra “cả câu chính là câu hỏi/cảm nhận người dùng muốn nói ra”, kẻo khóa văn phong phía sau xóa nhầm lời gốc của người dùng.
        // Thay đổi then chốt của fixed11 không nằm ở đây mà ở nhánh chỉnh câu nhẹ: nhánh này không còn gọi khóa cứng nguyên văn, cho phép đổi từ, đảo trật tự và ngắt câu bình thường.
        if(!out.length&&source.length<=500&&/tại sao|vì sao|thế nào|có phải|có nên|có được không|được không|có thể không|cảm thấy|thích|yêu|muốn|muốn lại|sợ|lo|buồn|vui|giận|tủi thân|[?]/i.test(source))push(source);
        return out;
    }

    function customDirectionLocalIssues(draft, custom = '') {
        const direction=String(custom||'').trim(),text=String(draft||'').trim();
        if(!direction||!text)return [];
        const issues=[];
        for(const family of CUSTOM_ACTION_FAMILIES){
            if(directionHasAffirmativeMatch(family.request,direction)&&!directionHasAffirmativeMatch(family.output,text))issues.push(`Chưa thực hiện hành động cốt lõi người dùng chỉ định: ${family.label}`);
        }
        for(const required of customExpressionRequirements(direction)){
            if(!draftPreservesCustomExpression(text,required))issues.push(`Bản sinh ra đã xóa mất phần then chốt trong lời thoại, câu hỏi hoặc cảm nhận người dùng chỉ định: “${required.slice(0,140)}”`);
        }
        const asksOpenChoice=directionHasAffirmativeMatch(/(?:hỏi|hỏi ý|xin ý kiến)[^.!?]{0,80}(?:mấy cái|bao nhiêu|cái nào|những cái nào|có nên|có phải|chọn thế nào)|(?:mấy|bao nhiêu|cái nào)[^.!?]{0,50}(?:lỗ|cái|chiếc|lần|loại)/i,direction);
        if(asksOpenChoice){
            if(!/(?:hỏi|hỏi ý|xin ý kiến|mấy cái|bao nhiêu|cái nào|lựa chọn|ý kiến|trả lời)/i.test(text))issues.push('Đã đổi câu hỏi mở mà người dùng yêu cầu giữ lại thành một hành vi khác');
            const directionHasFixedAnswer=/(?:chỉ|thì|quyết định|lựa chọn|chọn|muốn|bấm|làm|mua|gọi)\s*(?:một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười|\d+)\s*(?:cái|chỗ|lần|chiếc|loại|lỗ)/i.test(direction);
            const draftInventsFixedAnswer=/(?:chỉ|thì|quyết định|lựa chọn|chọn|muốn|bấm|làm|mua|gọi)\s*(?:một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười|\d+)\s*(?:cái|chỗ|lần|chiếc|loại|lỗ)/i.test(text);
            if(!directionHasFixedAnswer&&draftInventsFixedAnswer)issues.push('Tự ý quyết hộ số lượng hoặc phương án cụ thể cho một câu hỏi mở');
        }
        return issues;
    }

    function customDirectionLightPolishIssues(draft, custom = '') {
        const direction=String(custom||'').trim(),text=String(draft||'').trim();
        if(!direction||!text)return [];
        const issues=[];
        // Chỉnh câu nhẹ được phép đổi từ, đảo trật tự và ngắt câu lại, nên tuyệt đối không lấy “câu gốc gần như còn nguyên văn” làm điều kiện cứng.
        // Ở đây chỉ giữ những sự thật cấu trúc thật sự không được phép bị gọt mất: hành động cốt lõi và trạng thái còn bỏ ngỏ của câu hỏi mở.
        for(const family of CUSTOM_ACTION_FAMILIES){
            if(directionHasAffirmativeMatch(family.request,direction)&&!directionHasAffirmativeMatch(family.output,text))issues.push(`Chưa thực hiện hành động cốt lõi người dùng chỉ định: ${family.label}`);
        }
        const asksOpenChoice=directionHasAffirmativeMatch(/(?:hỏi|hỏi ý|xin ý kiến)[^.!?]{0,80}(?:mấy cái|bao nhiêu|cái nào|những cái nào|có nên|có phải|chọn thế nào)|(?:mấy|bao nhiêu|cái nào)[^.!?]{0,50}(?:lỗ|cái|chiếc|lần|loại)/i,direction);
        if(asksOpenChoice){
            if(!/(?:hỏi|hỏi ý|xin ý kiến|mấy cái|bao nhiêu|cái nào|lựa chọn|ý kiến|trả lời|có nên|có phải)/i.test(text))issues.push('Đã đổi câu hỏi mở mà người dùng yêu cầu giữ lại thành một hành vi khác');
            const directionHasFixedAnswer=/(?:chỉ|thì|quyết định|lựa chọn|chọn|muốn|bấm|làm|mua|gọi)\s*(?:một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười|\d+)\s*(?:cái|chỗ|lần|chiếc|loại|lỗ)/i.test(direction);
            const draftInventsFixedAnswer=/(?:chỉ|thì|quyết định|lựa chọn|chọn|muốn|bấm|làm|mua|gọi)\s*(?:một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười|\d+)\s*(?:cái|chỗ|lần|chiếc|loại|lỗ)/i.test(text);
            if(!directionHasFixedAnswer&&draftInventsFixedAnswer)issues.push('Tự ý quyết hộ số lượng hoặc phương án cụ thể cho một câu hỏi mở');
        }
        return [...new Set(issues)];
    }


    function customDirectionExpansionIssues(draft, custom = '') {
        const direction=String(custom||'').trim(),text=String(draft||'').trim();
        if(!direction||!text)return [];
        const issues=[...customDirectionLightPolishIssues(text,direction)];
        const a=normalizeRelayEchoText(text),b=normalizeRelayEchoText(direction);
        const originalCount=Math.max(1,relayTextCharCount(direction));
        const draftCount=relayTextCharCount(text);
        const ratio=draftCount/originalCount;
        if(a===b || (b.length>=12 && a.includes(b) && ratio<1.12))issues.push('AI mở rộng thực chất trả lại gần như nguyên văn của người dùng, chưa thật sự mở rộng');
        const minRatio=originalCount<40?1.18:originalCount<180?1.12:1.06;
        if(ratio<minRatio && draftCount<originalCount+18)issues.push('AI mở rộng quá ít, mới chỉ đổi vài chữ hoặc thêm dấu câu');
        const stageStripped=stripParentheticalStageDirections(direction);
        if(stageStripped!==direction && /[(][^()]{1,220}(?:sau đó|rồi thì|tiếp đó|kế đó|tôi|anh ấy|cô ấy|mình)[^()]{0,220}[)]/i.test(text))issues.push('Chỉ dẫn sân khấu trong ngoặc vẫn được giữ nguyên, chưa viết lại thành tự sự tự nhiên');
        return [...new Set(issues)];
    }


    function detectFigurativeLanguageIssues(text, custom = '') {
        const source = String(text || '').trim();
        const direction=String(custom||'').trim();
        // Lời gốc mà người dùng yêu cầu nói ra được ưu tiên hơn danh sách từ cấm về văn phong; những
        // ẩn dụ do AI tự thêm vào các câu khác thì vẫn tiếp tục bị chặn.
        const protectedExpressions=customExpressionRequirements(direction);
        const value=protectedExpressions.length
            ? source.split(/(?<=[.!?])|\n+/).filter(part=>!protectedExpressions.some(required=>draftPreservesCustomExpression(part,required))).join('\n').trim()
            : source;
        if (!value) return [];
        const issues = [];
        // Khóa cứng lối kể thẳng: thà chặn nhầm còn hơn để ẩn dụ/so sánh/nhân hóa/hình ảnh văn vẻ lọt vào bản cuối.
        const explicitSimile = /\b(?:như thể|giống như|tựa như|tựa hồ|y như|hệt như|chẳng khác nào|khác nào|dường như|tưởng chừng như|như)\b[^.!?\n]{0,56}/i;
        if (explicitSimile.test(value)) issues.push('Phát hiện dấu hiệu ví von/so sánh (như, như thể, tựa như, chẳng khác nào…)');
        if (/\b(?:như vậy|như thế|như in|y hệt|hệt vậy|kiểu như|một cách.{0,12}(?:như|tựa))\b/i.test(value)) issues.push('Phát hiện cấu trúc tu từ so sánh (như vậy / y hệt / kiểu như)');
        const abstractMetaphor = /(?:không khí|thời gian|sự im lặng|màn đêm|ánh trăng|ánh đèn|ánh mắt|tầm mắt|âm thanh|cảm xúc|tâm trạng|đáy lòng|lồng ngực|trái tim|tâm trí|dòng suy nghĩ|hơi thở|bầu không khí)[^.!?\n]{0,18}(?:đông cứng|đóng băng|nổ tung|bùng lên|trào dâng|cuộn trào|lan ra|lan tỏa|bốc cháy|rơi xuống|đè xuống|ập tới|dính chặt|ghim chặt|thiêu đốt|nuốt chửng|nhấn chìm|xé toạc|cắt ngang|bao bọc|cuốn phăng|tràn ngập|lên men|xuyên thấu|thì thầm|rì rầm|ôm lấy|vuốt ve|hôn lên)/i;
        if (abstractMetaphor.test(value)) issues.push('Phát hiện lối diễn đạt văn chương kiểu ẩn dụ/nhân hóa');
        if (/\b(?:như|giống như|tựa như)\s+(?:một|những|cái|con|đám|khối|mảng|thứ|kẻ)\b/i.test(value)) issues.push('Phát hiện cấu trúc ví von rủi ro cao');
        return [...new Set(issues)];
    }

    function npcSubjectCandidates(environment = {}, entry = null) {
        const out = new Set(['cô ấy', 'anh ấy', 'chị ấy', 'nàng', 'hắn', 'đối phương', 'người đó', 'cô gái', 'chàng trai', 'người phụ nữ', 'người đàn ông', 'nhân vật', 'NPC']);
        const c = ctx() || {};
        const userName = String(c.name1 || '').trim();
        const add = value => {
            const name = String(value || '').trim();
            if (!name || name === userName || name.length > 24) return;
            out.add(name);
        };
        add(c.name2);
        add(entry?.message?.name);
        try {
            const people = environment?.r9s1p1?.people || environment?.state?.people || [];
            for (const row of Array.isArray(people) ? people : []) {
                add(row?.['Họ tên']); add(row?.['Tên']); add(row?.name); add(row?.character); add(row?.['Nhân vật']);
            }
        } catch {}
        return [...out].sort((a, b) => b.length - a.length);
    }

    const VIETNAMESE_PRONOUN_ALIASES = ['cô', 'anh', 'chị', 'em', 'ông', 'bà', 'nó', 'tôi', 'bạn', 'ta', 'mình'];
    function npcShortAgencyAliases(subjects = []) {
        const aliases = new Set();
        for (const raw of subjects || []) {
            const name = String(raw || '').trim();
            if (!/^[A-Za-zÀ-ỹ]+(?:\s+[A-Za-zÀ-ỹ]+){1,4}$/.test(name)) continue;
            const words = name.split(/\s+/);
            // Vietnamese calls people by the last element of the name ("Nguyễn Thị Mai" -> "Mai");
            // a single common word collides with ordinary verbs and particles too often.
            const last = words[words.length - 1];
            if (last.length >= 2) aliases.add(last);
        }
        return [...aliases].filter(x => x && !VIETNAMESE_PRONOUN_ALIASES.includes(x.toLowerCase())).sort((a,b)=>b.length-a.length);
    }

    function npcReferenceIsObject(value, index) {
        const prefix=String(value||'').slice(Math.max(0,Number(index||0)-12),Number(index||0));
        return /(?:với|cho|tới|đến|về phía|nhìn|nhìn về phía|nhìn chằm chằm|ngắm|ôm|khoác|kéo|dắt|đỡ|quỳ trước|đứng cạnh|ngồi cạnh|nằm cạnh|tựa vào|đi tới chỗ|về chỗ|đặt vào|đưa cho|để lại cho)\s+$/i.test(prefix);
    }

    function hasEmbeddedNpcAgency(clause, subjects = [], agencyVerb = /$a/) {
        const value = String(clause || '').trim();
        if (!value) return false;
        const full = (subjects || []).map(name => String(name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).filter(Boolean);
        const aliases = npcShortAgencyAliases(subjects).map(name => String(name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).filter(Boolean);
        // Tên đầy đủ/đại từ được phép nằm giữa mệnh đề, ví dụ “nghe cô ấy yêu cầu…”. Trạng thái tĩnh đã bị loại ở lớp ngoài.
        if (full.length) {
            const re = new RegExp(`(?:${full.join('|')})\\s*(?:liền|đã|rốt cuộc|từ từ|bỗng|đột nhiên|lại|cũng|vẫn|đang|chưa|không|bắt đầu|tiếp tục|sau đó|rồi|thì|vô thức|theo bản năng)?\\s*${agencyVerb.source}`, 'gi');
            for(const match of value.matchAll(re))if(!npcReferenceIsObject(value,match.index))return true;
        }
        // Tên gọi tắt chỉ được nhận diện ở ranh giới mệnh đề, tránh đụng với các mảnh chính văn thông thường.
        if (aliases.length) {
            const re = new RegExp(`(?:^|[,;.!?\\s])(?:${aliases.join('|')})\\s*(?:(?:liền|đã|rốt cuộc|từ từ|bỗng|đột nhiên|lại|cũng|vẫn|đang|chưa|không|bắt đầu|tiếp tục|sau đó|rồi|thì|vô thức|theo bản năng)\\s*)*${agencyVerb.source}`, 'gi');
            for(const match of value.matchAll(re))if(!npcReferenceIsObject(value,match.index))return true;
        }
        return false;
    }

    function detectNpcAgencyIssues(text, subjects = []) {
        const value = String(text || '').trim();
        if (!value) return [];
        const issues = [];
        const names = subjects.length ? subjects : npcSubjectCandidates();
        const escaped = names.map(name => String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).filter(Boolean);
        if (!escaped.length) return [];
        const subject = `(?:${escaped.join('|')})`;

        // Khóa ngữ nghĩa chủ thể P20:
        // “Tóc cô ấy vẫn còn ướt / người cô ấy vẫn quấn khăn tắm / trên da cô ấy còn đọng nước” là quan sát tĩnh, được phép.
        // Thứ thật sự bị cấm là char/NPC sinh ra hành động, lời thoại, phản hồi, lựa chọn hay phản ứng cơ thể chủ động mới trong bản tiếp sức của user.
        const clauseStart = new RegExp(
            `^(?:[“”\"'‘’\\s]*(?:và|nhưng|rồi|sau đó|tiếp đó|thế là|lúc này|khi đó)?[“”\"'‘’\\s]*)(${subject})(?=\\s|$)`,
            'i'
        );

        const agencyVerb = /(?:nói|nói rằng|cất tiếng|hỏi|hỏi lại|trả lời|đáp|đáp lại|phản hồi|hét|gọi|lẩm bẩm|khẽ nói|yêu cầu|xin|mời|đề nghị|bảo|nhắc|đồng ý|chấp nhận|từ chối|gật đầu|lắc đầu|cười|khóc|cau mày|nhướn mày|chớp mắt|nhắm mắt|mở mắt|nhìn về phía|nhìn sang|liếc|dời ánh mắt|né tránh|tránh đi|lảng đi|giãy giụa|chống cự|phối hợp|chiều theo|lại gần|áp sát|áp vào|tựa vào|lùi lại|lùi ra|quay người|trở mình|đứng dậy|đứng lên|ngồi dậy|ngồi xuống|nằm xuống|đi về phía|đi qua|đi tới|bước lại gần|chạy|sải bước|xê dịch|di chuyển|cử động|nhấc tay|giơ lên|đưa tay|chìa ra|nắm lấy|túm lấy|ôm lấy|ôm chặt|vòng tay|buông ra|siết chặt|đẩy ra|kéo lại|giữ chặt|đè lên|chạm vào|sờ|vuốt ve|hôn|cắn|liếm|cọ|đá|giẫm|quỳ|ngồi xổm|cúi người|cúi xuống|nhấc chân|kẹp lấy|mở ra|khép lại|co người|run|run rẩy|rùng mình|co rúm|giật giật|thở gấp|thở dốc|tim đập nhanh|đỏ mặt|ửng đỏ|rơi nước mắt|bật khóc|cởi ra|cởi bỏ|mặc vào|khoác lên|tháo ra|cài lại|buộc lại|cầm lên|đặt xuống|đưa cho|nhận lấy|quay đầu|nghiêng đầu|cúi đầu|ngẩng đầu)/i;

        const staticState = /(?:làn da|mái tóc|tóc|ngọn tóc|quần áo|áo|áo sơ mi|quần|váy|giày|tất|cổ tay áo|vạt áo|khuôn mặt|gương mặt|má|mắt|đôi mắt|môi|bàn tay|cổ tay|cánh tay|vai|lưng|eo|chân|đầu gối|bàn chân|cổ chân|trên người|trên mặt|cổ áo|gấu áo)[^.!?\n]{0,26}(?:vẫn|còn|vẫn còn|đã|đang)?\s*(?:là|có|mang|dính|treo|áp|mặc|quấn|phủ|ướt|ướt sũng|ẩm|đỏ|ửng đỏ|tái nhợt|lạnh ngắt|ấm|rất lạnh|rất nóng|rất ướt|rất khô|không|chưa|trông có vẻ|có vẻ|giữ nguyên|đang ở)/i;
        const firstPersonClause = /^(?:tôi|mình|tớ|ta)\b/i;

        const clauses = value.match(/[^,;.!?\n]+[,;.!?\n]?/g) || [value];
        for (const rawClause of clauses) {
            const clause = String(rawClause || '').replace(/^[,;.!?\\s]+/, '').trim();
            // P34: kiểm tra “chủ thể hành động nằm giữa mệnh đề” trước, rồi mới xét xem mệnh đề có mở đầu bằng tên nhân vật hay không.
            // P33 đặt bước này sau `if (!matched) continue`, khiến những hành động NPC ẩn phổ biến nhất như
            // “nghe cô ấy yêu cầu…”, “nhìn Mộng đi tới…” bị bỏ qua thẳng.
            if (hasEmbeddedNpcAgency(clause, names, agencyVerb)) {
                issues.push(`char/NPC sinh ra hành động/lời thoại/yêu cầu mới ngay giữa mệnh đề: ${clause.slice(0, 58)}`);
                continue;
            }

            // Khi mệnh đề mở đầu rõ ràng bằng ngôi thứ nhất của user thì không được coi tên người ở vị trí tân ngữ phía sau là chủ thể hành động.
            if (firstPersonClause.test(clause)) continue;

            const matched = clause.match(clauseStart);
            if (!matched) continue;

            const afterSubject = clause.slice(matched[0].length).replace(/^(?:\s*của)?\s*/i, '');
            const isStatic = staticState.test(clause) && !agencyVerb.test(afterSubject);
            if (isStatic) continue;

            if (agencyVerb.test(afterSubject)) {
                issues.push(`char/NPC sinh ra hành động/phản hồi/phản ứng cơ thể mới: ${clause.slice(0, 58)}`);
                continue;
            }

            // Với cấu trúc chủ thể hành động rõ ràng thì vẫn chặn một cách thận trọng; quan sát thuần tĩnh không còn bị chặn nhầm.
            if (/^(?:đang|bắt đầu|tiếp tục|bỗng|đột nhiên|lại|liền|thì|nhưng|chưa|không|chẳng)\b/i.test(afterSubject)) {
                issues.push(`Nghi ngờ char/NPC trở thành chủ thể của hành vi mới: ${clause.slice(0, 58)}`);
            }
        }
        return [...new Set(issues)];
    }

    function replayNgrams(text) {
        const value = String(text || '').toLowerCase().replace(/[\s,.!?;:“”"'‘’()\[\]【】—…]+/g, ' ').trim();
        const grams = new Set();
        // Vietnamese repetition shows up as repeated word runs, not repeated characters.
        const words = value.match(/[\p{L}\p{N}_]+/gu) || [];
        for (const word of words) if (word.length >= 3) grams.add(word);
        for (let n=2;n<=3;n+=1) for(let i=0;i+n<=words.length;i+=1) grams.add(words.slice(i,i+n).join(' '));
        return grams;
    }

    function replaySimilarity(targetText, sourceText) {
        const target=replayNgrams(targetText), source=replayNgrams(sourceText);
        if(target.size<10 || source.size<10) return {score:0,common:0};
        let common=0; target.forEach(g=>{if(source.has(g))common+=1;});
        const containment=common/Math.max(1,Math.min(target.size,source.size));
        const jaccard=common/Math.max(1,target.size+source.size-common);
        return {score:Math.max(containment,jaccard*1.5),common};
    }

    function replaySegmentAuthorizedByCustom(segment, custom = '') {
        const direction=String(custom||'').trim();
        if(!direction)return false;
        if(draftPreservesCustomExpression(segment,direction))return true;
        const hit=replaySimilarity(segment,direction);
        return (hit.common>=16&&hit.score>=0.38)||(hit.common>=10&&hit.score>=0.52);
    }

    function immediatePlotReplayIssues(draft, entry, custom = '') {
        const text = String(draft || '').trim();
        if (!text || !entry) return [];
        const sources = [
            { label:`AI mới nhất, tầng ${Number(entry.index ?? -1)}`, text:String(entry.text || '') },
            { label:'Tin nhắn user trước đó', text:String(previousUserBefore(entry)?.text || '') },
        ].filter(item => item.text.trim());
        if (!sources.length) return [];

        // Chỉ chặn những trường hợp “phát lại rõ ràng”, tránh chặn nhầm chỉ vì cùng một cảnh lặp lại tên người/địa điểm/vật phẩm.
        // Soát cả bản đầy đủ lẫn từng đoạn câu dài trên 24 ký tự, để bắt được kiểu “kể lại lượt trước rồi mới thêm một câu hành động mới”.
        const segments=[text, ...(text.match(/[^.!?\n]{24,}[.!?]?/g)||[])];
        let best=null;
        for(const source of sources){
            for(const segment of segments){
                if(replaySegmentAuthorizedByCustom(segment,custom))continue;
                const hit=replaySimilarity(segment,source.text);
                if(!best || hit.score>best.score) best={label:source.label,score:hit.score,common:hit.common,segment};
            }
        }
        if(best && ((best.common>=24 && best.score>=0.40) || (best.common>=14 && best.score>=0.58))){
            return [`Phát hiện phát lại nhịp truyện vừa rồi: bản tiếp sức của user trùng lặp rất cao với ${best.label} (${Math.round(best.score*100)}%); tiếp sức bắt buộc phải viết “bước kế tiếp”, không được diễn lại chuyện vừa xảy ra bằng cách đổi câu chữ`];
        }
        return [];
    }

    function oldPlotReplayIssues(draft, entry, custom = '') {
        const text=String(draft||'').trim();
        if (!text || Number(entry?.index ?? -1) < 7) return [];
        const chat=Array.isArray(ctx()?.chat)?ctx().chat:[];
        const cutoff=Math.max(0, Number(entry.index)-continuityFloorCount());
        if (cutoff <= 0) return [];

        // Soát đồng thời bản đầy đủ và từng đoạn câu dài. Nhờ vậy kiểu “phát lại một đoạn cũ rồi thêm một câu an toàn ở sau”
        // sẽ không bị câu an toàn đó pha loãng độ tương đồng của cả bài.
        const segments=[text, ...(text.match(/[^.!?\n]{18,}[.!?]?/g)||[])];
        let best=null;
        for(let i=0;i<cutoff;i+=1){
            const message=chat[i];
            if(!message || message.is_system || !textOf(message)) continue;
            const sourceText=textOf(message);
            for(const segment of segments){
                if(replaySegmentAuthorizedByCustom(segment,custom))continue;
                const hit=replaySimilarity(segment,sourceText);
                if(!best || hit.score>best.score) best={floor:i,score:hit.score,common:hit.common,segment};
            }
        }
        if(best && ((best.common>=18 && best.score>=0.32) || (best.common>=10 && best.score>=0.46))){
            return [`Phát hiện phát lại tình tiết cũ: bản tiếp sức trùng lặp rất cao với tầng ${best.floor} trong lịch sử (${Math.round(best.score*100)}%), nhưng tầng đó không nằm trong cửa sổ liền mạch ${continuityFloorCount()} tầng gần nhất`];
        }
        return [];
    }

    function detectDraftIssues(draft, { entry, custom = '', allowJump = false, environment = null } = {}) {
        const text = String(draft || '').trim();
        const issues = [];
        if (!text) return ['Kết quả xuất ra rỗng'];
        issues.push(...detectFigurativeLanguageIssues(text,custom));
        issues.push(...immediatePlotReplayIssues(text, entry, custom));
        issues.push(...oldPlotReplayIssues(text, entry, custom));
        const latest = String(entry?.text || '');
        const signals = detectCompletionSignals(latest, previousUserBefore(entry).text);
        if (!explicitRepeatIntent(custom)) {
            for (const signal of signals) {
                const start = new RegExp(signal.start, 'i');
                if (start.test(text)) issues.push(`Trạng thái cốt truyện đi lùi: ${signal.label}, vậy mà lại khởi động cùng hành động đó một lần nữa`);
            }
        }
        // Tiếp sức của user chỉ được viết về user. char/NPC chỉ có thể xuất hiện với vai trò tân ngữ hoặc sự thật đã rồi, không được làm chủ ngữ của bất kỳ “hành động/phản hồi mới” nào.
        issues.push(...detectNpcAgencyIssues(text, npcSubjectCandidates(environment || {}, entry)));
        if (!allowJump) {
            const hardTimeJumps = text.match(/một lát sau|chẳng bao lâu sau|lát sau|vài phút sau|mười phút sau|nửa tiếng sau|một tiếng sau|vài tiếng sau|hôm sau|ngày hôm sau|về sau|cuối cùng|sau khi (?:tắm|ăn|làm|kết thúc) xong/gi) || [];
            if (hardTimeJumps.length >= 1) issues.push('Bản tiếp sức thông thường lại nhảy thời gian/giai đoạn; phải dừng ở cảnh hiện tại và chờ phản ứng của char/NPC ở lượt sau');
        }
        return [...new Set(issues)];
    }

    function normalizeRelayEchoText(value) {
        return String(value||'').toLowerCase().replace(/[\s,.!?;:“”"'‘’()\[\]【】—…<>«»]/g,'');
    }

    function draftPreservesCustomExpression(draft, custom) {
        const rawDraft=String(draft||''),rawCustom=String(custom||'').trim();
        if(rawCustom&&rawDraft.includes(rawCustom)){
            const index=rawDraft.indexOf(rawCustom),prefix=rawDraft.slice(Math.max(0,index-16),index);
            if(!/(?:đừng|chớ|không được|cấm|không cần|khỏi cần|không còn|không đi|không muốn|từ chối|hủy)\s*(?:lại|đi|làm|tiến hành|tiếp tục)?\s*$/i.test(prefix))return true;
        }
        const a=normalizeRelayEchoText(rawDraft), b=normalizeRelayEchoText(rawCustom);
        if(!b || b.length<4 || !a)return false;
        if(a===b)return true;
        // Bản tiếp sức được phép thêm hành động trước và sau lời gốc của người dùng; miễn là toàn bộ lời gốc sau khi chuẩn hóa vẫn còn liền mạch
        // thì phải coi là đã giữ lại, không được vì bản viết dài hơn mà bị tỷ lệ độ dài chặn nhầm.
        if(b.length>=8&&a.includes(b))return true;
        const ratio=a.length/Math.max(1,b.length);
        if(ratio>=0.72 && ratio<=1.38 && (a.includes(b)||b.includes(a)))return true;
        if(Math.min(a.length,b.length)<8)return false;
        const grams=value=>{const out=new Set();for(let i=0;i<value.length-1;i++)out.add(value.slice(i,i+2));return out;};
        const ag=grams(a),bg=grams(b);let common=0;for(const g of ag)if(bg.has(g))common++;
        const containment=common/Math.max(1,Math.min(ag.size,bg.size));
        return ratio>=0.72 && ratio<=1.38 && containment>=0.92;
    }

    function relayMaxChars() {
        const value=Number(runtime.settings?.relayMaxChars ?? 0);
        return Number.isFinite(value) ? Math.max(0,Math.min(20000,value)) : 0;
    }
    function relayRetryAttempts() {
        return Math.max(1,Math.min(6,Number(runtime.settings?.relayRetryAttempts||4)));
    }
    function relayRepairAttempts() {
        return Math.max(1,Math.min(6,Number(runtime.settings?.relayRepairAttempts||3)));
    }
    function relayContinuationLimit() {
        return Math.max(1,Math.min(6,Number(runtime.settings?.relayContinuationMax||3)));
    }
    function compactSafeDraft(raw) {
        // U1.4: mặc định không còn cắt cứng ở 800 chữ. 0 = không tự cắt; khi cần thì người dùng tự đặt giới hạn ký tự.
        // Chỉ kết quả gốc do mô hình trả về mới đi qua bước lọc từ bao bọc; phần người dùng tự sửa trong ô xem trước không còn bị xử lý như phần bao bọc của mô hình.
        return limitCompleteSentence(raw, relayMaxChars(), { cleanModelOutput:true });
    }

    async function relayEnvironment(entry, relayQuery = '') {
        const bridge = globalThis.VVVTheaterMemoryBridge;
        if (bridge && typeof bridge.getRelayContext === 'function') {
            try {
                const snapshot = await bridge.getRelayContext({ relayQuery, anchorFloor:Number(entry?.index ?? -1), continuityFloors:continuityFloorCount() });
                if (snapshot && typeof snapshot === 'object') {
                    return {
                        source: `R9S1P13 bridge ${snapshot.version || ''}`.trim(),
                        writingContext: snapshot.writingContext || {},
                        r9s1p1: snapshot.state || {},
                        latestCompanion: snapshot.latestCompanion || {},
                    };
                }
            } catch (error) {
                console.warn('[Tiếp sức cốt truyện bằng AI] Đọc cầu nối trạng thái chính R9 thất bại, hạ xuống dùng ngữ cảnh cơ bản', error);
            }
        }
        return {
            source: 'fallback',
            writingContext: {
                source: 'vvv-relay-scoped-fallback',
                generationType: 'relay-scoped',
                characterName: String(fallbackCharacterSnapshot()?.name || ctx()?.name2 || '').slice(0,160),
                presetAndWorldInfo: 'Chưa đọc; chỉ dùng phần tư liệu cốt truyện hữu hạn được cung cấp tường minh trong yêu cầu tiếp sức.',
            },
            r9s1p1: {},
            latestCompanion: entry?.message?.extra?.vvvTheaterCompanion || {},
        };
    }

    function stagnationHint(chat) {
        const recent = chat.slice(-24).map(item => item.text).join('\n');
        const changes = (recent.match(/rời đi|tới nơi|quyết định|phát hiện|xác nhận|bắt đầu|kết thúc|xung đột|đồng ý|từ chối|lời hẹn|nhiệm vụ/gi) || []).length;
        return {
            stage: recent.length < 2000 ? 'Mở màn / cảnh ngắn' : changes < 3 ? 'Giai đoạn tương tác ổn định' : 'Giai đoạn đẩy tới',
            possiblyStagnant: recent.length > 5000 && changes < 3,
            note: 'Chỉ dùng làm tham chiếu cho bước nhỏ kế tiếp, không được nhồi sự kiện vào.',
        };
    }

    function continuityRules(allowJump) {
        if (allowJump) return 'Người dùng đã chọn rõ ràng đẩy thời gian / du lịch / biến động lớn hoặc một bước nhảy tùy chỉnh: chỉ được thực hiện đúng bước nhảy đó; tối đa vượt qua một cảnh cần thiết, phải viết rõ mạch nhân quả nối tiếp, không nhảy qua nhiều nút cốt truyện một lượt, không tiện tay tạo thêm khúc ngoặt lớn thứ hai.';
        return 'Khóa liền mạch cốt truyện (ưu tiên cao nhất): chỉ đẩy tới nhịp nhỏ kế tiếp của cảnh hiện tại. Giữ nguyên thời gian, địa điểm, nhân vật đang có mặt, giai đoạn quan hệ và quán tính cảm xúc; trước hết phải tiếp nhận những sự thật đã xảy ra ở đoạn cuối chính văn AI mới nhất. Cấm nhảy thời gian/địa điểm/nhân vật một cách vô cớ; cấm đột ngột nhảy vọt quan hệ hoặc trở mặt; cấm bịa ra sự kiện lớn, thiết định mới hay NPC then chốt; cấm viết “chuẩn bị / đề nghị / đang đi tới / muốn làm” thành “đã hoàn tất”. Cho phép user viết một chuỗi hành động, cảm nhận và lời thoại liền mạch trong cùng thời gian/địa điểm, nhưng bắt buộc dừng lại ở chỗ cần char/NPC phản ứng; tuyệt đối không trả lời, quyết định, đồng ý, nói năng, tiến lại, ôm, hôn hay làm bất kỳ hành động mới nào thay cho char/NPC.';
    }

    function normalizeRelayCustomInput(value = '') {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            return {
                userText: String(value.userText || '').trim(),
                notes: String(value.notes || value.custom || '').trim(),
                expand: Boolean(value.expand),
            };
        }
        // Tương thích với lời gọi cũ: trước đây một chuỗi đơn lẻ nghĩa là “ý bổ sung / hướng tùy chỉnh”, vẫn đưa cho AI sinh nội dung.
        return { userText:'', notes:String(value || '').trim(), expand:true };
    }

    function relayTextCharCount(value = '') {
        return [...String(value||'').replace(/\s+/g,'').trim()].length;
    }

    function relayExpansionLengthInstruction(value = '') {
        const count=Math.max(1,relayTextCharCount(value));
        const min=Math.max(count+24,Math.round(count*1.35));
        const max=Math.min(700,Math.max(min+48,Math.round(count*2.15)));
        return `Bản gốc khoảng ${count} chữ; sau khi mở rộng nên vào khoảng ${min}-${max} chữ. Không phải viết cho đủ số chữ, nhưng bắt buộc phải đầy đặn hơn bản gốc một cách rõ rệt.`;
    }

    function relayCustomContract(input = '') {
        const custom=normalizeRelayCustomInput(input);
        const chunks=[];
        if(custom.userText){
            chunks.push(custom.expand
                ? `Nguyên văn của user (chế độ mở rộng tự nhiên; bắt buộc viết lại và mở rộng thật sự, giữ nguyên toàn bộ hành động cốt lõi, trình tự, đối tượng và ý định lời nói; ${relayExpansionLengthInstruction(custom.userText)}): ${custom.userText}`
                : `Nguyên văn của user (chế độ chỉnh câu nhẹ; chỉ sắp lại trật tự từ, dấu câu, ranh giới hành động và lời thoại, không thêm tình tiết): ${custom.userText}`);
        }
        if(custom.notes)chunks.push(`Ý bổ sung (gửi cho AI cùng nguyên văn của user; dùng để ràng buộc giọng điệu, hướng đi và chi tiết, không bắt buộc viết vào từng chữ): ${custom.notes}`);
        return chunks.join('\n');
    }

    function relayCustomVerificationTarget(input = '') {
        const custom=normalizeRelayCustomInput(input);
        // Khi đã có nguyên văn rõ ràng của user thì lấy nguyên văn làm lõi cứng; ý bổ sung chỉ là hướng dẫn mềm, tránh để bộ kiểm tra hiểu nhầm ghi chú thành lời thoại bắt buộc xuất hiện nguyên văn.
        return custom.userText || custom.notes;
    }

    async function buildPrompt(customInput = '', pinnedEntry = null) {
        const entry = pinnedEntry || commandEntry();
        if (!entry) throw new Error('Hiện chưa có chính văn AI nào để tiếp sức');
        const custom=normalizeRelayCustomInput(customInput);
        const customContract=relayCustomContract(custom);
        const verificationTarget=relayCustomVerificationTarget(custom);
        if(runtime.selected.has('custom')&&!custom.userText&&!custom.notes)throw new Error('Đã chọn “Tùy chỉnh”, hãy điền phần chữ của user hoặc ý bổ sung');
        const chosen = [...runtime.selected].map(id => DIRECTIONS.find(item => item[0] === id)?.[1]).filter(Boolean);
        if (customContract) chosen.push(`Tùy chỉnh: ${customContract.slice(0, 900)}`);
        if (!chosen.length) chosen.push('Tiến triển tự nhiên');
        if (runtime.settings?.fateEnabled && (runtime.selected.has('random') || runtime.settings?.fateAutoEnabled)) {
            const card = runtime.currentFateCard || (runtime.selected.has('random') ? drawFateCard({ manual:true }) : maybeAutoFate(entry));
            if (card) chosen.push(`Thẻ định mệnh 【${FATE_CATEGORY_LABELS[card.category] || card.category}】: ${card.text}`);
        }
        // P21: khi viết lại hoặc khôi phục sau khi bị ngắt, ngữ cảnh chỉ cắt tới “mốc neo AI ổn định”.
        // Phần AI dở dang do bị ngắt và tin nhắn user chờ thay thế đứng trước nó đều không được làm nhiễu bản tiếp sức mới.
        const chat = transcript(continuityFloorCount(), entry.index, { excludeOpening:true });
        const jump = chosen.some(item => item.includes('Đẩy thời gian') || item.includes('Du lịch/liên thành') || item.includes('Biến động lớn')) || /hôm sau|vài tiếng sau|du lịch|công tác|sang thành phố khác|biến động lớn|nhảy tới|đi thẳng tới/i.test(`${custom.userText} ${custom.notes}`);
        const currentTurn = currentTurnSnapshot(entry);
        const relayQuery = buildRelayQuery(currentTurn, chosen);
        const promptAnchor=anchorFromEntry(entry);
        const environment = await relayEnvironment(entry, relayQuery);
        if(!relayAnchorIsCurrent(promptAnchor))throw new Error('Trong lúc dựng ngữ cảnh tiếp sức, cuộc trò chuyện hoặc tầng AI mới nhất đã thay đổi; kết quả lần này bị hủy bỏ');
        runtime.lastEnvironment = environment;
        environment.currentReality = currentTurn;
        environment.currentRealityHardFacts = currentTurn.hardFacts || [];
        environment.timelinePriority = [
            '1. currentRealityHardFacts = những sự thật đã hoàn tất do mã nguồn xác định, ưu tiên cao nhất.',
            '2. Đoạn cuối chính văn AI mới nhất (currentReality.currentRealityTail) = giá trị thật của hiện thực hiện tại.',
            '3. Chính văn AI mới nhất + tin nhắn user trước đó = sự thật của lượt hiện tại.',
            '4. Cảnh (scene) và trạng thái nhân vật hiện tại của R9.',
            '5. Cửa sổ nguyên văn gần nhất.',
            '6. Các bản tổng kết/kết quả truy xuất của R9 chỉ là tham chiếu lịch sử; khi mâu thuẫn thì bắt buộc bỏ qua tư liệu cũ.',
            '7. Phần tư liệu cốt truyện hữu hạn và các quy tắc được cung cấp tường minh trong yêu cầu này.',
        ];
        environment.recentChat = chat;
        environment.recentChatPolicy = { floors: continuityFloorCount(), requestedMemoryWindow: normalizedRecentFloorCount(), note: 'Cách ly liền mạch P24: phần nguyên văn thật sự dùng để viết tiếp hiện tại luôn chỉ mang theo 6 tầng gần nhất, và khi mạch truyện vượt quá 6 tầng thì loại hẳn tin nhắn mở màn. Nội dung cũ hơn chỉ được đi vào với tư cách sự thật lịch sử thông qua ký ức có cấu trúc/truy xuất của R9, không được dùng làm khuôn mẫu cho hành động hiện tại.' };
        environment.director = directorAppliesToRelay() ? { enabled:true, ...stagnationHint(chat) } : { enabled:false, note:'Đạo diễn cốt truyện 0-32 không tác động lên Tiếp sức cốt truyện bằng AI' };
        environment.controlLayer = controlLayerSnapshot(entry);
        return `Bạn chỉ viết thay cho user một lượt hành động/lời thoại có thể gửi đi ngay, không viết tiếp chính văn của assistant/nhân vật, không quyết định thay nhân vật đối diện.
Hướng: ${chosen.join(' + ')}

【HỢP ĐỒNG HÀNH ĐỘNG TÙY CHỈNH CỦA NGƯỜI DÙNG｜ƯU TIÊN CAO NHẤT LƯỢT NÀY】
${customContract ? `${custom.userText ? `- Nguyên văn user cần gửi đi: ${custom.userText.slice(0,12000)}\n- AI mở rộng: ${custom.expand ? `Bật. Bắt buộc viết lại và mở rộng thật sự, không phải chép lại nguyên văn hay chỉ thêm dấu câu. ${relayExpansionLengthInstruction(custom.userText)} Giữ nguyên trình tự hành động, đối tượng nhân vật và ý định lời nói vốn có; với điều kiện không thêm phản hồi thay cho char/NPC, hãy bổ sung phần nối tiếp hành động của user, giọng điệu, tư thế, khoảng ngừng và những chi tiết cảm giác tức thời cần thiết.` : 'Tắt. Vẫn phải gọi AI để chỉnh câu ở mức nhẹ: chỉ sửa trật tự từ, dấu câu, ranh giới hành động/lời thoại và các câu nói sai rõ rệt; không tự thêm hành động mới, lời thoại mới, tình tiết mới hay kết quả mới.'}` : '- Không có nguyên văn cố định của user; hãy dựa vào ý bổ sung để sinh một lượt nhập liệu mới cho user.'}
${custom.notes ? `- Ý bổ sung: ${custom.notes.slice(0,1200)}\n- Nguyên văn của user ở trên và ý bổ sung phải được đọc cùng nhau trong một lần sinh. Ý bổ sung dùng để ràng buộc giọng điệu, hướng đi hoặc chi tiết; nếu mâu thuẫn với nguyên văn của user thì lấy nguyên văn của user làm chuẩn.` : '- Không có ý bổ sung nào thêm.'}
- Bắt buộc thực hiện đúng cùng một hành động cốt lõi, cùng điểm đến, cùng đối tượng và cùng ý định; được bổ sung quá trình hợp lý, nhưng cấm đổi sang một hành động khác.
- Nếu phần trong ngoặc đơn ở nguyên văn của người dùng mô tả các hành động kiểu “sau đó, rồi thì, tiếp đó, anh ấy/tôi đã làm…”, mặc định coi đó là chỉ dẫn sân khấu/chỉ thị viết, không phải lời nhân vật phải nói ra; bắt buộc viết lại thành hành động tự sự bình thường và đặt lời thoại trước sau dấu ngoặc về đúng chỗ, tuyệt đối không đọc thẳng cả phần hành động lẫn lời chú giải trong ngoặc thành thoại.
- Nếu nguyên văn thuộc kiểu thay đổi vị trí cơ thể do user chủ động gây ra, như “user đỡ/ôm/kéo/dắt char tới một vị trí nào đó”, “để char ngồi lên đùi mình”, thì được viết char ở vai trò tân ngữ của hành động user, ví dụ “bạn đỡ lấy eo cô ấy, kéo cô ấy về phía đùi mình”; như vậy không phải là hành động tự chủ thay cho char. Cấm viết thêm cảnh char chủ động phối hợp, gật đầu, đáp lại, hôn hay bất kỳ phản ứng tự chủ nào khác.
- Nếu bản thân nguyên văn của user chính là lời thoại, câu hỏi hoặc cách bày tỏ cảm nhận mà họ muốn nói ra, phải giữ lại cách diễn đạt cốt lõi và ý nghĩa của nó; chế độ mở rộng cho phép đổi kiểu câu, thêm dấu ngoặc kép và ngắt câu một cách tự nhiên, không bắt buộc chép nguyên từng chữ.
${custom.userText&&custom.expand?`【YÊU CẦU CHẤT LƯỢNG KHI MỞ RỘNG TỰ NHIÊN｜BẮT BUỘC THỰC HIỆN】
- Không được trả lại nguyên văn y như cũ; không được chỉ thêm dấu phẩy, dấu chấm hay đổi dấu ngoặc thành một từ nối.
- Trước hết hãy tách nguyên văn theo trình tự tự nhiên “hành động → lời thoại → hành động → lời thoại”, rồi bổ sung một ít chi tiết hành động phía user, sao cho cả đoạn giống một tin nhắn người chơi viết nghiêm túc chứ không phải bản hướng dẫn sử dụng.
- Giữ chất khẩu ngữ cho những lời thoại đã có trong nguyên văn, đừng tự ý đổi thành văn vẻ sáo rỗng, sến súa, giọng “tổng tài” hay giọng truyện người lớn rẻ tiền.
- Không kể lại chính văn của assistant ở lượt trước, không giải thích động cơ thay user, không viết tâm lý hay phản hồi của char.
- ${relayExpansionLengthInstruction(custom.userText)}
- Ví dụ chuyển đổi để tham khảo: nguyên văn “tôi đi tới bên cạnh cô ấy nói, đợi chút (sau đó tôi ngồi xuống và kéo cô ấy lên đùi) thế này dễ chịu hơn không” → có thể viết thành “tôi đi tới bên ghế cô ấy, khẽ bảo cô ấy đợi một chút, rồi ngồi xuống ghế, đưa tay đỡ lấy eo cô ấy, kéo người cô ấy về phía đùi mình: ‘Thế này dễ chịu hơn không?’”; chỉ học cách sắp xếp, không chép lại câu ví dụ.` : ''}
${verificationTarget && !custom.userText && customExpressionRequirements(verificationTarget).length?`- Lời thoại/câu hỏi bắt buộc giữ lại từng câu:\n${customExpressionRequirements(verificationTarget).map(item=>`  · ${item}`).join('\n')}`:''}
${custom.userText && !custom.expand ? `【CHẾ ĐỘ CHỈNH CÂU NHẸ｜GIỚI HẠN CỨNG】\n- Đây không phải viết tiếp tự do. Chỉ được sắp xếp lại nguyên văn của user ở trên: sửa trật tự từ, cách ngắt câu, dấu câu, cách trỏ của đại từ, ranh giới giữa lời thoại và hành động.\n- Được viết lại phần chú giải hành động trong ngoặc thành hành động tự sự bình thường, nhưng không được đọc phần chú giải đó thành lời thoại.\n- Không được tự thêm hành động mới, lời thoại mới, quyết định mới, tình tiết mới hay kết quả mới mà nguyên văn không có; về nguyên tắc độ dài không vượt quá khoảng 1,35 lần nguyên văn.\n- Ý bổ sung chỉ giúp xác định giọng điệu/cách sắp xếp, không được mượn cớ đó để biến việc chỉnh câu nhẹ thành một đoạn mở rộng dài.` : ''}
- Bắt buộc giữ đúng chủ thể và đối tượng của “ai làm gì với ai” trong chỉ thị gốc. Nếu chỉ thị yêu cầu NPC làm gì đó thì chỉ được viết thành user đề nghị, ra hiệu hoặc chờ NPC đó làm, không được đánh tráo thành user tự đưa ra một quyết định khác.
- Những câu hỏi mở như “mấy cái, bao nhiêu, chọn cái nào, có nên không” bắt buộc phải để ngỏ, dừng lại ở chỗ chờ nhân vật tương ứng trả lời; cấm tự điền ra số lượng, phương án, lời đồng ý hay từ chối.
- Nếu các hướng khác, thẻ định mệnh, gợi ý của Đạo diễn hay ký ức cũ mâu thuẫn với chỉ thị tùy chỉnh này thì bỏ qua toàn bộ phần mâu thuẫn và tuân theo hợp đồng hành động này.` : '- Lượt này không có hợp đồng hành động tùy chỉnh, hãy tiến triển tự nhiên theo hướng đã chọn.'}

【NGÔI KỂ CỦA LƯỢT NÀY｜YÊU CẦU CỨNG】
- ${relayPerspectiveInstruction()}
- Ngôi kể chỉ đổi nhân xưng trong lời kể của user, không đổi sự thật hiện tại, quan hệ nhân vật, ranh giới chủ thể USER, quyền hạn của NPC hay hướng đi của mạch truyện.
${continuityRules(jump)}

【SỰ THẬT CỨNG CỦA HIỆN THỰC HIỆN TẠI｜do mã nguồn xác định, cao hơn truy xuất/tổng kết/scene cũ】
${currentTurn.hardFacts?.length ? currentTurn.hardFacts.map(item => `- ${item}`).join('\n') : '- Không nhận diện thêm sự thật cứng nào; vẫn lấy đoạn cuối chính văn AI mới nhất làm chuẩn.'}

【QUY TẮC GIÁ TRỊ THẬT CỦA DÒNG THỜI GIAN｜cao hơn mọi ký ức cũ】
- Đoạn cuối của chính văn AI mới nhất chính là “bây giờ”. Những hành động nó đã ghi rõ là hoàn tất thì coi như đã xong, tuyệt đối không được khởi động lại, trừ khi phần tùy chỉnh của người dùng yêu cầu rõ “làm lại một lần nữa”. Nếu tin nhắn user trước đó nói rõ là đã di chuyển từ A sang B thì B là địa điểm hiện tại, A lập tức hạ xuống thành địa điểm quá khứ.
- 【CÁCH LY MỞ MÀN P24】Tầng 0/tầng 1 và lời mở đầu của nhân vật chỉ là điểm khởi đầu lịch sử. Một khi mốc neo hiện tại đã vượt quá 6 tầng thì nghiêm cấm sao chép, viết lại hay thực hiện lại chuỗi hành động, chuỗi địa điểm, chuỗi vật phẩm hoặc chuỗi lời thoại trong lời mở đầu; kể cả khi truy xuất lịch sử lại trúng vào đó thì cũng chỉ được coi là sự thật quá khứ.
- Nếu bạn thấy một đoạn tư liệu cũ và cảnh hiện tại đều rất cụ thể, bắt buộc chọn “nguyên văn 6 tầng gần nhất + đoạn cuối AI mới nhất”, tuyệt đối không được vì tư liệu cũ dài hơn, sinh động hơn mà quay về tình tiết cũ.
- Nếu scene của R9, các bản tổng kết, retrievalHits hay đoạn chat cũ mâu thuẫn với chính văn AI mới nhất thì luôn lấy chính văn AI mới nhất làm chuẩn.
- Trước hết hãy xác định vị trí cơ thể hiện tại của user, họ đang làm gì, vừa hoàn tất việc gì, rồi mới viết bước kế tiếp. Cấm để mạch truyện đi lùi.
- ${custom.userText ? (custom.expand ? `Lượt này là chế độ mở rộng tự nhiên: ${relayExpansionLengthInstruction(custom.userText)} Đừng gò cho đủ 300-800 chữ, cũng đừng bơm một câu ngắn thành cả đoạn tiểu thuyết.` : 'Lượt này là chế độ chỉnh câu nhẹ: đừng mở rộng để cho đủ chữ, hãy bám sát độ dài nguyên văn, chỉ làm câu văn trôi chảy và rõ ràng hơn.') : 'Nên viết thành một đoạn user hoàn chỉnh khoảng 300-800 chữ; user được phép có chuỗi hành động nhỏ liền mạch, cảm nhận chân thật và lời thoại trong cùng một cảnh hiện tại. U1.4 mặc định không cắt cứng ở 800 ký tự; nếu người dùng có đặt giới hạn ký tự cho phần tiếp sức thì bắt buộc tuân theo giới hạn đó.'}
- Không viết kiểu liệt kê dàn trải xuyên thời gian/địa điểm, không viết trước những kết quả tương lai chỉ có thể xảy ra sau khi char/NPC đáp lời.

【KHÓA CỨNG NGỮ NGHĨA VỀ RANH GIỚI CHỦ THỂ｜TUYỆT ĐỐI KHÔNG ĐƯỢC VI PHẠM】
- Trong cả đoạn, chỉ user mới được sinh ra hành động chủ động mới, lời thoại mới, quyết định mới và cảm nhận mới.
- Được phép quan sát khách quan trạng thái tĩnh sẵn có của char/NPC, ví dụ “tóc cô ấy vẫn còn ướt”, “người cô ấy vẫn quấn khăn tắm”, “quần áo cô ấy vẫn còn ẩm”; quan sát tĩnh không tính là hành động thay cho NPC.
- Trong tin nhắn user này, char/NPC không được sinh ra bất kỳ hành động tự chủ mới, thay đổi biểu cảm, lời nói, phản hồi, sự đồng ý, từ chối, tiến lại, né tránh, gật đầu, lắc đầu hay phản ứng cơ thể chủ động nào. Những gì nguyên văn của người dùng yêu cầu rõ ràng như “user đỡ/ôm/kéo/dắt char tới một vị trí nào đó” thì được viết thành hành động chủ động của user, char chỉ đóng vai trò tân ngữ, không được tiện tay viết thêm cảnh char chủ động phối hợp.
- Dùng tên đầy đủ, đại từ hay biệt danh đều như nhau: ví dụ nhân vật “Fujiwara Mộng” mà viết thành “Mộng bước tới / Mộng nói / cô ấy yêu cầu / cô ấy đưa tay” thì vẫn là vượt quyền, bắt buộc dừng lại ở hành động hoặc lời thoại của user.
- Cấm viết những hành vi mới kiểu “cô ấy cười / cô ấy gật đầu / cô ấy ngả vào / cô ấy không né / cô ấy ôm lấy tôi / cô ấy nói… / anh ấy quay người / đối phương đáp lại…”.
- Nếu một câu buộc phải mô tả char/NPC sắp làm gì thì hãy dừng bút ngay khi hành động hoặc lời thoại của user kết thúc.

【QUY TẮC KỂ THẲNG TUYỆT ĐỐI｜ngang cấp với khóa trạng thái cốt truyện】
- Những lời gốc, câu hỏi và cách tự bày tỏ có tính so sánh mà phần tùy chỉnh của người dùng yêu cầu nói ra thì không bị ràng buộc bởi danh sách từ cấm về văn phong; các quy tắc dưới đây chỉ giới hạn phần tu từ do AI tự thêm vào.
- Từ chối lối viết ví von: cấm so sánh trực tiếp, ẩn dụ, loại suy, nhân hóa, tượng trưng, phóng đại và hình ảnh văn vẻ.
- Cấm dùng các cấu trúc so sánh/ví von như “như, như thể, giống như, tựa như, tựa hồ, y như, hệt như, chẳng khác nào, dường như, tưởng chừng như, như vậy, y hệt”.
- Cấm những câu ẩn dụ hay nhân hóa kiểu “không khí đông cứng, cảm xúc trào dâng, ánh mắt thiêu đốt, âm thanh ập xuống, màn đêm ôm lấy, trong lòng nổ tung”.
- Chỉ viết những sự thật quan sát hoặc xác nhận được trực tiếp: hành động cụ thể, tư thế, vị trí, sự tiếp xúc, cảm nhận thực tế và lời thoại trực tiếp của user. Phần miêu tả phải mộc mạc, chính xác, không tu từ.
Chỉ xuất ra phần chính văn có thể gửi đi ngay dưới dạng tin nhắn của user, không xuất phân tích, tiêu đề, danh sách lựa chọn, giải thích, JSON, thẻ XML hay khối mã. Chỉ dùng phần tư liệu cốt truyện hữu hạn được cung cấp tường minh trong yêu cầu này, không suy đoán những thiết định chưa được cung cấp.

【SỔ CÁI QUY TẮC 0-32｜ưu tiên cao】
${(() => { const r=environment.controlLayer?.ledger||{}; const lines=[...(r.long||[]).map(x=>`Dài hạn: ${x}`),...(r.chapter||[]).map(x=>`Chương này: ${x}`),...(r.timed||[]).map(x=>`Tạm thời (còn ${x.remaining} tầng): ${x.text}`)]; return lines.length?lines.map(x=>`- ${x}`).join('\n'):'- Không có quy tắc bổ sung'; })()}

【THẺ ĐỊNH MỆNH 0-32｜ràng buộc mềm】
${environment.controlLayer?.fateCard ? `- ${environment.controlLayer.fateCard.categoryLabel}: ${environment.controlLayer.fateCard.text}\n- Thẻ định mệnh chỉ gieo mầm cho “điều gì có thể xảy ra”; nếu mâu thuẫn với chính văn mới nhất, thiết định nhân vật, sổ cái quy tắc hay khóa liền mạch cốt truyện thì bắt buộc hạ cấp hoặc bỏ qua.` : '- Lượt này không có thẻ định mệnh.'}

【MÔI TRƯỜNG CỐT TRUYỆN HIỆN TẠI CỦA SILLYTAVERN】
${JSON.stringify(environment)}

【NHẮC CUỐI】Hãy xem currentReality.currentRealityTail trước. Nó là trạng thái thật của lúc này; nó là “vạch xuất phát”, không phải chất liệu để bạn viết lại. Câu đầu tiên của phần tiếp sức cho user bắt buộc phải xảy ra sau nó, không được tóm tắt, kể lại hay đổi câu chữ để diễn lại chính văn AI vừa rồi.`;
    }

    function strip(raw) {
        let value = String(raw || '')
            .replace(/<think>[\s\S]*?<\/think>/gi, '')
            .replace(/<analysis>[\s\S]*?<\/analysis>/gi, '')
            .replace(/^\s*```(?:text|markdown|md|json)?\s*/i, '')
            .replace(/\s*```\s*$/i, '')
            .replace(/^\s*(?:assistant|user|người dùng|chính văn|kết quả|trả lời)\s*[:]\s*/i, '')
            .trim();
        if ((value.startsWith('“') && value.endsWith('”')) || (value.startsWith('\"') && value.endsWith('\"'))) value = value.slice(1, -1).trim();
        return value;
    }

    function cleanRelayModelOutput(raw) {
        let value = strip(raw).replace(/\r\n?/g, '\n').trim();
        if (!value) return '';
        // Một số mô hình còn bọc thêm lời khách sáo/tiêu đề bên ngoài chính văn; những thứ đó không phải nội dung tin nhắn của user.
        for (let pass=0; pass<3; pass+=1) {
            const cleaned=value
                .replace(/^\s*(?:【\s*)?(?:chính văn|kết quả|trả lời|assistant|user|người dùng)(?:\s*】)?\s*[:]\s*/i, '')
                .replace(/^\s*(?:dưới đây (?:là|chính là)|sau đây (?:là|chính là))[,.!:\s]*/i, '')
                // “Được, tôi đẩy cửa ra” có thể là lời thoại thật; chỉ bóc bỏ khi ngay sau nó là một từ bao bọc rõ ràng.
                .replace(/^\s*(?:được rồi|được thôi|dĩ nhiên|đã hiểu|vâng|ok)[,.!:\s]+(?=(?:【\s*)?(?:chính văn|kết quả|trả lời|dưới đây|sau đây))/i, '')
                .trim();
            if (cleaned===value) break;
            value=cleaned;
        }
        // Chỉ xử lý những dòng chú thích đứng riêng, tránh làm hỏng lời thoại bình thường trong chính văn.
        const lines = value.split('\n').map(line => line.trim()).filter(Boolean);
        while (lines.length && /^(?:được rồi|đã hiểu|dĩ nhiên rồi|dưới đây (?:là|chính là)|sau đây (?:là|chính là)|chính văn như sau)[,.!:\s]*$/i.test(lines[0])) lines.shift();
        while (lines.length && /^(?:lưu ý|chú thích|ghi chú|giải thích|tái bút|trên đây (?:là|chính là)|hy vọng|nếu bạn còn cần|bạn có muốn tôi viết tiếp)[:,\s]/i.test(lines.at(-1))) lines.pop();
        value = lines.join('\n').trim();
        // Những dấu kết thúc quen thuộc đến từ khuôn mẫu preset, không thuộc phần chính văn có thể gửi đi.
        value = value.replace(/(?:^|\n)\s*(?:\(hết\)|\[hết\]|hết|kết thúc|nội dung trên)[.!]?\s*$/i, '').trim();
        return value;
    }

    function limitCompleteSentence(raw, maxChars = relayMaxChars(), { cleanModelOutput = false } = {}) {
        const source = cleanModelOutput ? cleanRelayModelOutput(raw) : String(raw ?? '').replace(/\r\n?/g, '\n').trim();
        const chars = [...source];
        const requested=Number(maxChars||0);
        if(!Number.isFinite(requested)||requested<=0)return chars.join('').trim();
        const limit=Math.max(1,Math.min(20000,requested));
        if(chars.length<=limit)return chars.join('');
        const first=chars.slice(0,limit).join('');
        const matches=[...first.matchAll(/[。！？!?；;]\s*/g)];
        const cut=matches.length?matches.at(-1).index+matches.at(-1)[0].length:limit;
        return [...first].slice(0,cut).join('').trim();
    }

    const RELAY_SYSTEM_PROMPT = `${FALLEN_WRITER_CONTEXT}
【NHIỆM VỤ TIẾP SỨC AI】Bạn là người viết thay phần nhập liệu của user trong mạch truyện tương tác. Hành động tùy chỉnh mà người dùng nhập rõ ràng ở lượt này là sự thật có ưu tiên cao nhất: bắt buộc thực hiện đúng cùng một hành động cốt lõi, cùng điểm đến, cùng đối tượng và cùng ý định, chỉ được bổ sung quá trình, tuyệt đối không được đánh tráo sang việc khác. Nếu người dùng có cung cấp “lời user cần gửi đi” và bật AI mở rộng, bạn bắt buộc phải viết lại và mở rộng thật sự một cách tự nhiên: không trả lại nguyên văn, không chỉ thêm dấu câu, không kéo dài một câu ngắn một cách máy móc; hãy sắp lại trình tự hành động và lời thoại, chuyển chỉ dẫn sân khấu trong ngoặc thành tự sự tự nhiên, và bổ sung một chút phần nối tiếp hành động, giọng điệu, tư thế, khoảng ngừng hoặc chi tiết cảm giác tức thời chỉ thuộc về user. Nếu tắt AI mở rộng thì chỉ chỉnh câu ở mức nhẹ. Nếu phần tùy chỉnh của người dùng vốn đã là lời thoại, câu hỏi hay cách bày tỏ cảm nhận mà họ muốn nói ra, hãy giữ ý chính và chất khẩu ngữ; khi mở rộng được phép đổi kiểu câu tự nhiên chứ không khóa cứng từng chữ. Tuân thủ nghiêm khóa liền mạch cốt truyện, khóa cứng ngữ nghĩa về chủ thể USER và quy tắc kể thẳng tuyệt đối. Chỉ user mới được sinh ra hành động chủ động, lời thoại, quyết định và cảm nhận mới; được phép mô tả khách quan trạng thái tĩnh sẵn có của char/NPC. Những gì người dùng viết rõ như “đỡ/ôm/kéo/dắt char tới một vị trí nào đó” thì được thực hiện như hành động chủ động của user, char chỉ đóng vai trò tân ngữ; ngoài ra không được thêm cho char/NPC hành động tự chủ, thay đổi biểu cảm, lời nói, phản hồi, yêu cầu, lời mời, sự đồng ý, từ chối hay phản ứng cơ thể chủ động nào. Tên đầy đủ, đại từ và biệt danh của nhân vật đều được nhận diện là cùng một chủ thể; tuyệt đối không được viết bước kế tiếp của user thành cả một lượt cảnh có đầy đủ phản hồi của char/NPC. Cấm AI tự thêm bất kỳ phép ví von, so sánh, nhân hóa, tượng trưng, phóng đại hay hình ảnh văn vẻ nào. Độ dài tuân theo yêu cầu động của lượt này, không viết lan man cho đủ chữ. Chỉ xuất ra chính văn của user.`;

    function configuredSourceMode() {
        return 'independent';
    }

    function configuredSourceLabel() {
        return 'API riêng của Tiếp sức AI · tư liệu cốt truyện hữu hạn';
    }

    function isProviderPolicyRefusalText(value) {
        return /prompt could not be submitted|contains? sensitive words?|generative AI prohibited use policy|prohibited use policy|content policy (?:violation|blocked|refusal)|blocked (?:by|due to) safety|finishReason["':\s]+SAFETY|không gửi được nội dung nhắc|chứa từ nhạy cảm|chính sách cấm sử dụng.*AI tạo sinh|vi phạm chính sách.*(?:nội dung|sử dụng)|bị.*(?:kiểm duyệt|hệ thống) an toàn.*chặn/i.test(String(value||''));
    }

    function providerPolicyRefusalError(value) {
        const error=new Error(String(value||'Nhà cung cấp từ chối theo chính sách').slice(0,1000));
        error.name='ProviderPolicyRefusalError';error.code='provider-policy-refusal';error.policyRefusal=true;
        return error;
    }

    function isProviderPolicyRefusalError(error) {
        return Boolean(error?.policyRefusal === true
            || String(error?.name||'') === 'ProviderPolicyRefusalError'
            || String(error?.code||'') === 'provider-policy-refusal'
            || isProviderPolicyRefusalText(error?.message));
    }

    const RELAY_POLICY_RECOVERY_SYSTEM_PROMPT = [
        'Bạn là một trình biên tập văn bản tiếng Việt, chỉ xử lý phần văn bản của user được đưa ra tường minh trong yêu cầu này.',
        'Nhiệm vụ của bạn là sắp xếp lại hoặc mở rộng tự nhiên chính hành động, lời thoại và câu hỏi của user; không được viết thêm phản hồi, tâm lý, biểu cảm, hành động hay kết luận mới của nhân vật đối diện/NPC.',
        'Đừng đọc hay phỏng đoán bất kỳ đoạn chat cũ, sách thế giới, RAG, điện thoại, bản tổng kết hay bối cảnh nào không được cung cấp trong yêu cầu này.',
        'Giữ nguyên ý chính, đối tượng nhân vật, trình tự hành động và các câu hỏi để ngỏ của nguyên văn; phần chú giải hành động trong ngoặc có thể chuyển thành tự sự tự nhiên.',
        'Chỉ xuất ra chính văn của user có thể gửi đi ngay, không giải thích, không tiêu đề, không nhãn, không phân tích.',
        'Tuân thủ chính sách sử dụng hiện hành của dịch vụ mô hình.',
    ].join('\n');

    function buildPolicyRecoveryPrompt(input = '') {
        const custom=normalizeRelayCustomInput(input);
        const source=String(custom.userText||'').trim();
        const notes=String(custom.notes||'').trim();
        if(!source&&!notes)throw new Error('Bước khôi phục ngữ cảnh tối thiểu thiếu văn bản user hoặc ý bổ sung để biên tập');
        const mode=source
            ? (custom.expand
                ? `Mở rộng tự nhiên: bắt buộc viết lại thật sự, không được trả lại nguyên văn; ${relayExpansionLengthInstruction(source)} Chỉ bổ sung phần nối tiếp hành động, giọng điệu, khoảng ngừng và cảm nhận tức thời cần thiết phía user, không thêm phản hồi của nhân vật đối diện.`
                : 'Chỉnh câu nhẹ: chỉ sắp lại trật tự từ, dấu câu, ranh giới hành động và lời thoại; không thêm tình tiết, hành động, lời thoại hay kết quả mới.')
            : 'Dựa vào ý bổ sung để sinh một lượt nhập liệu ngắn gọn cho user; chỉ viết về user, không viết phản hồi của nhân vật đối diện.';
        return `【KHÔI PHỤC NGỮ CẢNH TỐI THIỂU CHO TIẾP SỨC AI】
Lần này chỉ xử lý phần chữ được cung cấp tường minh dưới đây, không mang theo tình tiết cũ, sách thế giới, RAG, điện thoại, bản tổng kết hay bất kỳ ngữ cảnh lịch sử nào.

【NGÔI KỂ】
${relayPerspectiveInstruction()}

【CHẾ ĐỘ XỬ LÝ】
${mode}

【NGUYÊN VĂN CỦA USER】
${source||'(không được cung cấp)'}

【Ý BỔ SUNG】
${notes||'không có'}

【YÊU CẦU CỨNG】
1. Giữ nguyên hành động cốt lõi, đối tượng, trình tự trước sau, câu hỏi và ý định lời nói của nguyên văn.
2. Những câu hỏi để ngỏ trong nguyên văn phải giữ nguyên trạng thái để ngỏ, không trả lời thay đối phương.
3. Chuyển hành động trong ngoặc thành tự sự bình thường, không đọc phần chú giải trong ngoặc thành lời thoại.
4. Chỉ user mới được sinh ra hành động chủ động, lời thoại, quyết định và cảm nhận mới; không thêm phản hồi chủ động của char/NPC.
5. Không trích dẫn, không viết thêm bất kỳ sự thật bối cảnh nào không xuất hiện trong yêu cầu này.
6. Chỉ xuất ra chính văn của user có thể gửi đi ngay.`;
    }

    async function independent(prompt, { systemPrompt = RELAY_SYSTEM_PROMPT, jsonMode = false, responseLength = null, signal = null } = {}) {
        const requested = responseLength === null || responseLength === undefined || responseLength === '' ? Number.NaN : Number(responseLength);
        const body = {
            prompt: String(prompt || '').trim(),
            systemPrompt: String(systemPrompt || '').trim(),
            promptPipeline: {
                source:'vvv-relay-scoped', generationType:'relay-scoped',
                presetIncluded:false, worldBookIncluded:false, personaIncluded:false,
            },
            feature: 'relay',
            jsonMode: Boolean(jsonMode),
        };
        if (Number.isFinite(requested)) body.maxTokens = Math.max(128, Math.min(100000, requested));
        runtime.lastProviderFinishReason='';let data;
        try {
            data = await serverJson('/generate', {
                method: 'POST',
                body: JSON.stringify(body),
                signal,
            });
        } catch (error) {
            if (error?.policyRefusal === true || String(error?.name||'') === 'ProviderPolicyRefusalError' || String(error?.code||'') === 'provider-policy-refusal' || isProviderPolicyRefusalText(error?.message)) {
                runtime.lastGenerationSource='relay-independent-api';runtime.lastGenerationSourceLabel='API riêng của Tiếp sức AI · nhà cung cấp từ chối theo chính sách';
                const wrapped=providerPolicyRefusalError(error?.message||'Nhà cung cấp từ chối theo chính sách');
                wrapped.cause=error;
                throw wrapped;
            }
            throw error;
        }
        if(isProviderPolicyRefusalText(data?.text)){
            runtime.lastGenerationSource='relay-independent-api';runtime.lastGenerationSourceLabel='API riêng của Tiếp sức AI · nhà cung cấp từ chối theo chính sách';
            throw providerPolicyRefusalError(data.text);
        }
        runtime.lastPipelineDebug = data?.promptPipeline || body.promptPipeline;
        runtime.lastProviderFinishReason=String(data?.finishReason||'');
        runtime.lastGenerationSource='relay-independent-api';
        runtime.lastGenerationSourceLabel='API riêng của Tiếp sức AI · tư liệu cốt truyện hữu hạn';
        return data.text;
    }

    async function generateWithConfiguredApi(prompt, options = {}) {
        const owner = String(options.owner || 'Tiếp sức cốt truyện bằng AI');
        if(!runtime.configuredSourceReady)throw new Error('Nguồn viết của Tiếp sức AI chưa nạp xong');
        if(runtime.activeGeneration){const error=new Error(`${runtime.activeGenerationOwner||'Yêu cầu Tiếp sức AI trước đó'} vẫn đang chạy nốt ở nền; để tránh gọi trùng, hãy đợi nó kết thúc hẳn rồi thử lại`);error.name='RelayGenerationInFlightError';throw error;}
        const controller=new AbortController();
        const task=Promise.resolve().then(async()=>{
            const raw=await independent(prompt,{...options,signal:controller.signal});
            if(!String(raw||'').trim()){const error=new Error('API riêng của Tiếp sức cốt truyện bằng AI trả về nội dung rỗng');error.name='RelayEmptyResponseError';throw error;}
            return raw;
        });
        runtime.activeGeneration=task;
        runtime.activeGenerationOwner=owner;
        runtime.activeGenerationAbort=()=>controller.abort();
        try{return await task;}
        finally{if(runtime.activeGeneration===task){runtime.activeGeneration=null;runtime.activeGenerationOwner='';runtime.activeGenerationAbort=null;if(!runtime.busy)setBusy(false);}}
    }

    async function generateRaw(prompt) {
        return generateWithConfiguredApi(prompt, { owner:'Tiếp sức cốt truyện bằng AI', systemPrompt:RELAY_SYSTEM_PROMPT });
    }


    function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

    function relayRequestTimeoutMs() {
        const sec=Number(runtime.settings?.timeoutSeconds||runtime.serverConfig?.relay?.timeoutSeconds||90);
        return Math.max(10000,Math.min(1800000,Number.isFinite(sec)?sec*1000:90000));
    }

    async function withRelayTimeout(promise, timeoutMs=relayRequestTimeoutMs(), onTimeout = null) {
        let timer=0;
        try {
            return await Promise.race([
                Promise.resolve(promise),
                new Promise((_,reject)=>{timer=setTimeout(()=>{
                    try{onTimeout?.();}catch(_error){}
                    const e=new Error(`API riêng của Tiếp sức cốt truyện bằng AI quá hạn (${Math.round(timeoutMs/1000)} giây); lần này sẽ không tự đổi nguồn`);
                    e.name='RelayTimeoutError';e.code='relay-chain-timeout';e.permanentForCycle=true;reject(e);
                },timeoutMs);}),
            ]);
        } finally { if(timer)clearTimeout(timer); }
    }

    function relayErrorChainSome(error,predicate,seen=new Set()) {
        if(!error||typeof error!=='object'||seen.has(error))return false;
        seen.add(error);if(predicate(error))return true;
        return relayErrorChainSome(error.cause,predicate,seen)||relayErrorChainSome(error.primaryError,predicate,seen);
    }

    function isTransientRelayRequestError(error) {
        if(relayErrorChainSome(error,item=>item?.permanentForCycle===true))return false;
        const name=String(error?.name||'');
        if (name === 'AbortError') return false;
        if (name === 'RelayTimeoutError' || name === 'RelayGenerationInFlightError') return false;
        if (name === 'RelayEmptyResponseError') return true;
        const message = String(error?.message || error || '').toLowerCase();
        return /fetch failed|failed to fetch|network ?error|networkerror|load failed|timed? ?out|timeout|nội dung rỗng|phản hồi rỗng|econn|socket|connection reset|temporar(?:y|ily) unavailable|service unavailable|bad gateway|gateway timeout|http\s*(?:408|409|425|429|5\d\d)\b|\b(?:408|409|425|429|5\d\d)\b/.test(message);
    }

    function relayRetryDelay(attempt) {
        const base = Math.min(4200, 550 * Math.pow(1.5, Math.max(0, attempt - 1)));
        return Math.round(base + Math.random() * 180);
    }

    async function generateRawWithSilentRetry(prompt, { maxAttempts = relayRetryAttempts(), timeoutMs = relayRequestTimeoutMs() } = {}) {
        let lastError=null;
        runtime.lastGenerationSource='';runtime.lastGenerationSourceLabel='';
        runtime.retryNoticeShown=false;
        for(let attempt=1;attempt<=maxAttempts;attempt+=1){
            try {
                setBusy(true, attempt===1?'Đang sinh nội dung bằng API riêng của phần tiếp sức…':`Mạng chập chờn, tự động thử lại ${attempt}/${maxAttempts}…`);
                const chainTimeoutMs=Math.min(3600000,timeoutMs*2+15000);
                const raw=await withRelayTimeout(generateRaw(prompt),chainTimeoutMs,()=>runtime.activeGenerationAbort?.());
                if(!String(raw||'').trim()){
                    const e=new Error('Tiếp sức cốt truyện bằng AI trả về nội dung rỗng');e.name='RelayEmptyResponseError';throw e;
                }
                return raw;
            } catch(error) {
                lastError=error;
                if(!isTransientRelayRequestError(error))throw error;
                if(attempt>=maxAttempts)break;
                if(!runtime.retryNoticeShown){runtime.retryNoticeShown=true;toast('Mạng hoặc giao diện chập chờn trong chốc lát, 0-32 đang tự thử lại; bạn không cần bấm thêm lần nữa.','warning');}
                console.warn(`[Tiếp sức cốt truyện bằng AI] Yêu cầu thất bại, tự động thử lại ${attempt}/${maxAttempts}`,error);
                await sleep(relayRetryDelay(attempt));
            }
        }
        const finalError=new Error(`Tiếp sức cốt truyện bằng AI vẫn thất bại sau nhiều lần tự thử lại: ${String(lastError?.message||lastError||'lỗi không rõ')}`);
        finalError.cause=lastError;
        throw finalError;
    }

    async function generateRawWithPolicyRecovery(prompt, {
        customRequest = null,
        ensureCurrent = null,
        maxAttempts = relayRetryAttempts(),
        timeoutMs = relayRequestTimeoutMs(),
    } = {}) {
        try {
            return await generateRawWithSilentRetry(prompt,{maxAttempts,timeoutMs});
        } catch (error) {
            if(!isProviderPolicyRefusalError(error))throw error;
            try{ensureCurrent?.();}catch(anchorError){throw anchorError;}
            const request=normalizeRelayCustomInput(customRequest||{});
            if(!request.userText&&!request.notes)throw error;
            runtime.lastPipelineDebug={
                source:'vvv-relay-policy-context-recovery',
                generationType:'relay-policy-context-recovery',
                reason:'provider-policy-refusal',
                historyIncluded:false,
                worldBookIncluded:false,
                ragIncluded:false,
                phoneIncluded:false,
                summaryIncluded:false,
                safetySettingsModified:false,
            };
            runtime.lastGenerationSource='relay-policy-context-recovery';
            runtime.lastGenerationSourceLabel='API riêng của Tiếp sức AI · khôi phục ngữ cảnh tối thiểu';
            setBusy(true,'Ngữ cảnh đầy đủ bị nhà cung cấp từ chối, đang tự thử lại với ngữ cảnh tối thiểu…');
            if(!runtime.policyRecoveryNoticeShown){
                runtime.policyRecoveryNoticeShown=true;
                toast('Ngữ cảnh cốt truyện đầy đủ bị chính sách an toàn của nhà cung cấp từ chối; đã tự loại bỏ lịch sử không liên quan, sách thế giới và RAG, chỉ dùng phần chữ của bạn ở lượt này để thử lại. Cài đặt an toàn không bị thay đổi.','warning');
            }
            const safePrompt=buildPolicyRecoveryPrompt(request);
            try {
                const raw=await withRelayTimeout(
                    generateWithConfiguredApi(safePrompt,{ owner:'Tiếp sức cốt truyện bằng AI · khôi phục ngữ cảnh tối thiểu', systemPrompt:RELAY_POLICY_RECOVERY_SYSTEM_PROMPT }),
                    Math.min(3600000,timeoutMs*2+15000),
                    ()=>runtime.activeGenerationAbort?.(),
                );
                if(!String(raw||'').trim()){
                    const empty=new Error('Bước khôi phục ngữ cảnh tối thiểu của Tiếp sức cốt truyện bằng AI trả về nội dung rỗng');empty.name='RelayEmptyResponseError';throw empty;
                }
                try{ensureCurrent?.();}catch(anchorError){throw anchorError;}
                return raw;
            } catch (recoveryError) {
                if(isProviderPolicyRefusalError(recoveryError)){
                    const finalError=providerPolicyRefusalError(`Nhà cung cấp vẫn từ chối phần chữ hiện tại. Tiện ích đã tự thử khôi phục bằng “ngữ cảnh tối thiểu cần thiết”, nhưng sẽ không sửa hay lách qua cài đặt an toàn.\n${String(recoveryError?.message||'').slice(0,600)}`);
                    finalError.cause=recoveryError;
                    throw finalError;
                }
                throw recoveryError;
            }
        }
    }

    function relayFinishReasonIsTruncated(reason='') {
        return /(?:length|max[_ -]?tokens?|token[_ -]?limit|output[_ -]?limit)/i.test(String(reason||''));
    }

    function relayTextLooksTruncated(text='') {
        const value=String(text||'').trim();if(!value)return true;
        const pairs=[['“','”'],['「','」'],['『','』'],['（','）'],['(',')'],['【','】'],['[',']'],['《','》']];
        if(pairs.some(([open,close])=>(value.split(open).length-1)>(value.split(close).length-1)))return true;
        if(/[，,:：；;、（(\[【《“「『—-]$/.test(value))return true;
        if(/(?:và|nhưng|rồi|tiếp đó|đồng thời|vì|nên|chuẩn bị|sắp|vừa định|định|thử|muốn|nói rằng|hỏi rằng|đáp rằng)$/i.test(value))return true;
        return false;
    }

    function relayNeedsContinuation(text,finishReason='') {
        if(runtime.settings?.relayAntiTruncation===false)return false;
        return relayFinishReasonIsTruncated(finishReason)||relayTextLooksTruncated(text);
    }

    function mergeRelayContinuation(base,addition) {
        const left=String(base||'').trimEnd(),right=cleanRelayModelOutput(addition).replace(/^\s*(?:viết tiếp|tiếp tục|nối tiếp phần trên)\s*[:]\s*/i,'').trimStart();
        if(!right||/^<VVV_COMPLETE>$/i.test(right))return left;
        const max=Math.min(320,left.length,right.length);let overlap=0;
        for(let size=max;size>=4;size-=1)if(left.slice(-size)===right.slice(0,size)){overlap=size;break;}
        return `${left}${right.slice(overlap)}`.trim();
    }

    function buildRelayContinuationPrompt(partial,custom='') {
        return `【VIẾT TIẾP CHỐNG CẮT CỤT CHO TIẾP SỨC AI】\nĐoạn chính văn của user phía trước có thể đã bị cắt do chạm giới hạn token đầu ra. Chỉ viết tiếp từ đúng chỗ bị cắt, hoàn thành câu còn dang dở và khép lại bằng một hành động hoặc lời thoại trọn vẹn, tự nhiên của user; đừng viết lại, đừng tóm tắt, đừng lặp lại phần chữ đã có, và không được thêm hành động, lời thoại hay phản hồi của char/NPC. Nếu phần chữ đã có thực ra đã trọn vẹn thì chỉ xuất ra <VVV_COMPLETE>. Chỉ xuất ra phần chính văn cần nối thêm.\n\n【ĐOẠN CUỐI CỦA CHÍNH VĂN ĐÃ CÓ】\n${String(partial||'').slice(-8000)}${String(custom||'').trim()?`\n\n【HƯỚNG TIẾP SỨC BAN ĐẦU, chỉ để giữ đúng mục tiêu】\n${String(custom).trim().slice(0,500)}`:''}`;
    }

    async function completeTruncatedRelayText(initial,{custom='',ensureCurrent=()=>{}}={}) {
        let text=String(initial||'').trim(),finishReason=runtime.lastProviderFinishReason,count=0;
        while(relayNeedsContinuation(text,finishReason)&&count<relayContinuationLimit()){
            count+=1;setBusy(true,`Phát hiện phần tiếp sức bị cắt cụt, đang tự viết tiếp ${count}/${relayContinuationLimit()}…`);
            const addition=await generateRawWithSilentRetry(buildRelayContinuationPrompt(text,custom));ensureCurrent();
            if(/^\s*<VVV_COMPLETE>\s*$/i.test(String(addition||''))){finishReason='';break;}
            const merged=mergeRelayContinuation(text,addition);if(merged===text)throw new Error('Bước viết tiếp chống cắt cụt của Tiếp sức AI không trả về chính văn mới, đã dừng lại để khỏi tiêu tốn API vô ích');text=merged;finishReason=runtime.lastProviderFinishReason;
        }
        if(relayNeedsContinuation(text,finishReason))throw new Error(`Sau ${relayContinuationLimit()} lần viết tiếp liên tiếp, Tiếp sức AI vẫn bị mô hình cắt cụt; bản nháp chưa trọn vẹn đã bị chặn lại, hãy tăng “Token đầu ra tối đa” rồi thử lại`);
        runtime.lastContinuationCount+=count;return text;
    }

    function parseCustomDirectionVerdict(raw) {
        const source=String(raw||'').replace(/^\s*```(?:json)?/i,'').replace(/```\s*$/,'').trim();
        const match=source.match(/\{[\s\S]*\}/);if(!match)return null;
        try{
            const value=JSON.parse(match[0]);
            if(typeof value?.follows!=='boolean')return null;
            return {follows:value.follows,coreAction:String(value.coreAction||'').slice(0,160),conflict:String(value.conflict||'').slice(0,300)};
        }catch(_error){return null;}
    }

    async function verifyRelayCustomDraft({ request = null, custom = '', draft = '', entry = null } = {}) {
        const normalized=normalizeRelayCustomInput(request||{});
        const direction=String(custom||'').trim();
        const text=String(draft||'').trim();
        if(!direction||!text)return [];
        // fixed20: chỉ cần user đã tự cung cấp nguyên văn thì không dùng một LLM thứ hai làm “trọng tài” nữa.
        // Bộ trọng tài cũ hay chấm nhầm phần mở rộng bình thường là lệch hướng, sửa đi sửa lại rồi quay về nguyên văn, gây ra cảnh “chờ rất lâu mà chẳng đổi chữ nào”.
        if(normalized.userText&&!normalized.expand)return customDirectionLightPolishIssues(text,direction);
        if(normalized.userText&&normalized.expand)return customDirectionExpansionIssues(text,direction);
        return verifyCustomDirection({custom:direction,draft:text,entry});
    }


    async function verifyCustomDirection({ custom = '', draft = '', entry = null } = {}) {
        const direction=String(custom||'').trim(),text=String(draft||'').trim();
        const local=customDirectionLocalIssues(text,direction);
        if(!direction||!text)return local;
        if(local.length)return local;
        // Độ tương đồng cao ở đây là bằng chứng thuận cho việc “lời gốc được giữ lại”, không còn bị hiểu ngược thành lỗi kể lại.
        if(draftPreservesCustomExpression(text,direction))return [];
        const prompt=`Chỉ phán định tính nhất quán của hành động, không viết tiếp cốt truyện. So sánh “hướng người dùng chỉ định” với “bản sinh ra”: bản sinh ra được phép mở rộng các bước và lời thoại, nhưng thực tế phải giữ đúng cùng một hành động cốt lõi, cùng chủ thể, cùng đối tượng, cùng điểm đến và cùng ý định; nếu đổi A thành B thì bắt buộc phán false. Ví dụ “đi ăn cơm” bị viết thành “đi ngủ” là false. Nếu hướng ban đầu là “một người hỏi người khác mấy cái/bao nhiêu/chọn cái nào” thì bản sinh ra phải giữ nguyên người hỏi, người được hỏi và trạng thái còn bỏ ngỏ; tự ý điền số lượng hay câu trả lời thay bất kỳ ai đều phải phán false. Nếu bản thân hướng người dùng chỉ định đã là lời thoại, câu hỏi hay cảm nhận muốn nói ra, thì bản sinh ra giữ nguyên văn hoặc giữ gần nghĩa đều là follows=true, tuyệt đối không được vì “có kể lại lời người dùng” mà phán false. Nếu dấu ngoặc trong nguyên văn của người dùng đang mô tả hành động xảy ra sau đó thì đó là chỉ dẫn sân khấu, không phải lời thoại; bản sinh ra phải biến nó thành hành động tự sự chứ không đọc nội dung trong ngoặc ra thành thoại.\n\n【HƯỚNG NGƯỜI DÙNG CHỈ ĐỊNH】\n${direction.slice(0,500)}\n\n【BẢN SINH RA】\n${text.slice(0,6000)}\n\n【ĐOẠN CUỐI CHÍNH VĂN MỚI NHẤT, chỉ dùng để khử nhập nhằng】\n${tailText(entry?.text||'',1200)}\n\nChỉ xuất ra JSON: {"follows":true hoặc false,"coreAction":"hành động cốt lõi người dùng yêu cầu","conflict":"điểm lệch; không có thì để chuỗi rỗng"}`;
        let lastFailure='';
        for(let attempt=1;attempt<=2;attempt+=1){
            try{
                setBusy(true,`Đang đối chiếu tính nhất quán của hành động tùy chỉnh${attempt>1?' (thử lại)':''}…`);
                const raw=await withRelayTimeout(generateWithConfiguredApi(prompt,{owner:'Kiểm tra tính nhất quán hành động của Tiếp sức AI',systemPrompt:'Bạn là bộ phán định nghiêm ngặt về tính nhất quán của hành động, chỉ xuất ra JSON. Không được vì câu văn trôi chảy mà bỏ qua việc đánh tráo hành động; nếu lời gốc của người dùng được giữ lại chính xác thì phải phán là tuân thủ.',jsonMode:true,responseLength:260}),relayRequestTimeoutMs(),()=>runtime.activeGenerationAbort?.());
                const verdict=parseCustomDirectionVerdict(raw);
                if(!verdict){lastFailure='Bộ kiểm tra không trả về JSON hợp lệ';continue;}
                if(verdict.follows===false)return [...new Set([...local,`Hướng tùy chỉnh bị lệch về mặt ngữ nghĩa: ${verdict.conflict||`chưa thực hiện “${verdict.coreAction||direction.slice(0,80)}”`}`])];
                return local;
            }catch(error){
                lastFailure=String(error?.message||error||'Không dùng được giao diện kiểm tra').slice(0,180);
                console.warn(`[Tiếp sức cốt truyện bằng AI] Lần kiểm tra nhanh tính nhất quán hành động thứ ${attempt} thất bại`,error);
            }
        }
        return [...new Set([...local,`Kiểm tra hướng tùy chỉnh thất bại: ${lastFailure||'không xác nhận được bản sinh ra có tuân theo hành động đã chỉ định hay không'}; để tránh bị đánh tráo hành động, lần này sẽ không cho qua`])];
    }

    async function generateDraft(customInput = '') {
        const queue=globalThis.VVVUnifiedCore?.tasks;
        if(queue)return queue.run('Tiếp sức cốt truyện bằng AI',()=>generateDraftUnlocked(customInput),{group:'generation-control'});
        return generateDraftUnlocked(customInput);
    }

    async function generateDraftUnlocked(customInput = '') {
        const customRequest=normalizeRelayCustomInput(customInput);
        const custom=relayCustomVerificationTarget(customRequest);
        if(runtime.selected.has('custom')&&!customRequest.userText&&!customRequest.notes)throw new Error('Đã chọn “Tùy chỉnh”, hãy điền phần chữ của user hoặc ý bổ sung');
        if (runtime.busy||runtime.activeGeneration) throw new Error(`${runtime.activeGenerationOwner||'Yêu cầu Tiếp sức AI trước đó'} vẫn đang được xử lý, hãy đợi nút hoạt động trở lại rồi thử lại`);
        if (await isGenerating()) throw new Error('Chính văn của lượt trước vẫn đang được sinh, hãy đợi xong rồi mới tiếp sức');
        runtime.busy = true;
        runtime.policyRecoveryNoticeShown=false;
        setBusy(true,'Đang sinh nội dung bằng API riêng của phần tiếp sức…');
        try {
            const entry = commandEntry();
            if (!entry) throw new Error('Hiện chưa có chính văn AI nào để tiếp sức');
            const operationAnchor=anchorFromEntry(entry);
            const ensureCurrent=()=>{if(!relayAnchorIsCurrent(operationAnchor))throw new Error('Trong lúc Tiếp sức AI sinh nội dung, cuộc trò chuyện hoặc tầng AI mới nhất đã thay đổi; bản nháp lần này đã được hủy an toàn');};

            // fixed9: dù có bật “AI mở rộng” hay không, nguyên văn của user và ý bổ sung đều được đưa cho AI trong cùng một yêu cầu.
            // Tắt mở rộng = chỉnh câu ở mức nhẹ; bật mở rộng = mở rộng tự nhiên với điều kiện hành động cốt lõi không đổi.
            runtime.lastPipelineDebug={
                source:customRequest.userText?(customRequest.expand?'vvv-relay-user-text-expand':'vvv-relay-user-text-polish'):'vvv-relay-notes-generate',
                generationType:'relay-custom',
                aiExpanded:Boolean(customRequest.expand),
                lightPolish:Boolean(customRequest.userText&&!customRequest.expand),
                notesIncluded:Boolean(customRequest.notes),
            };

            const prompt = await buildPrompt(customRequest,entry);
            ensureCurrent();
            runtime.lastPipelineDebug = null;
            runtime.lastCustomDirection = relayCustomContract(customRequest);
            runtime.lastContinuationCount=0;let raw = await generateRawWithPolicyRecovery(prompt,{customRequest,entry,ensureCurrent});
            raw=await completeTruncatedRelayText(raw,{custom,ensureCurrent});
            ensureCurrent();
            let draft = compactSafeDraft(raw);
            const chosenLabels = selectedDirectionLabels();
            const allowJump = chosenLabels.some(item => /Đẩy thời gian|Du lịch\/liên thành|Biến động lớn/i.test(item)) || /hôm sau|vài tiếng sau|du lịch|công tác|sang thành phố khác|biến động lớn|nhảy tới|đi thẳng tới/i.test(`${customRequest.userText} ${customRequest.notes}`);
            let advisoryIssues = detectDraftIssues(draft, { entry, custom, allowJump, environment: runtime.lastEnvironment });
            // fixed33: bỏ phạm vi “kiểm tra cứng hậu kỳ / tự sửa lệch / chặn” cho hành động tùy chỉnh của Tiếp sức AI.
            // Lý do: lớp này hay chấm nhầm những cách diễn đạt gần nghĩa bình thường như “kéo vào lòng / áp môi lên” là chưa thực hiện
            // “ôm/hôn”, khiến bản đã sinh thành công lại bị vòng trọng tài thứ hai chặn lại.
            // Giờ nguyên văn của user và ý bổ sung chỉ đóng vai trò ràng buộc ưu tiên cao nhất trong prompt sinh nội dung; sau khi sinh xong
            // sẽ không gọi verifyRelayCustomDraft nữa, không còn tự viết lại vì từ khóa hành động cốt lõi, hành động trong ngoặc hay cách diễn đạt
            // gần nghĩa, cũng không ném ra lỗi “hành động tùy chỉnh không đạt” để chặn việc gửi.
            // Vẫn giữ: bảo vệ chống bản rỗng, viết tiếp khi bị cắt cụt, và các gợi ý heuristic cục bộ về chủ thể/tân ngữ, nhảy thời gian, tu từ;
            // các gợi ý này theo chế độ không chặn của R19: chỉ cảnh báo, không xóa bản viết, không thử lại, không chặn.
            runtime.lastActionGateDisabled=true;
            if(!draft.trim())throw new Error('Tiếp sức AI trả về bản rỗng, đã dừng việc gửi');

            // R19: khôi phục trải nghiệm mượt mà của bản cũ. Độ tương đồng phát lại, cú pháp NPC, nhảy thời gian và tu từ
            // Tất cả đều là kiểm tra heuristic, có thể nhập nhằng theo ngữ cảnh, nên chỉ nhắc chứ không xóa bản viết hay chặn cứng việc gửi.
            // fixed33: hành động người dùng nêu rõ không còn đi qua bước kiểm tra cứng ở phía sau; lấy ràng buộc trong prompt sinh nội dung làm chuẩn, tránh làm hại cách diễn đạt gần nghĩa.
            advisoryIssues=[...new Set(advisoryIssues)];
            runtime.lastAdvisoryIssues=advisoryIssues;
            if(advisoryIssues.length){
                console.warn('[Tiếp sức cốt truyện bằng AI] Gợi ý heuristic cục bộ (R19, không chặn)',advisoryIssues);
                toast(`Đã sinh xong bản tiếp sức; quy tắc cục bộ có ${advisoryIssues.length} gợi ý, đã cho qua theo chế độ bản cũ.`,'warning');
            }
            ensureCurrent();
            runtime.draft = limitCompleteSentence(draft, relayMaxChars());
            runtime.draftAnchor={...operationAnchor};
            runtime.previewCustom={...customRequest};
            if (!runtime.draft) throw new Error('Mô hình không sinh ra chính văn dùng được');
            toast(customRequest.userText ? (customRequest.expand ? '✒ AI đã mở rộng tự nhiên đúng ý ban đầu, sẽ không gửi thẳng nguyên văn.' : '✒ Đã chỉnh lại phần chữ của user và gộp ý bổ sung để hoàn tất phần tiếp sức.') : '✒ Tiếp sức cốt truyện bằng AI đã hoàn tất (API riêng).', 'success');
            if(runtime.lastContinuationCount)toast(`Bộ chống cắt cụt đã tự viết tiếp và ghép thêm ${runtime.lastContinuationCount} đoạn.`,'success');
            if (runtime.settings.directAfterGenerate) await send(runtime.draft,operationAnchor);
            else openPreview(runtime.draft, customRequest, operationAnchor);
        } finally {
            runtime.busy = false;
            setBusy(false);
        }
    }

    function setBusy(value, label='Đang sinh nội dung…') {
        const active=Boolean(runtime.activeGeneration);
        const effective=Boolean(value)||active;
        document.querySelectorAll('.vvv-relay-bar button,#vvv-relay-command button').forEach(node => {
            node.disabled = effective;
        });
        const generate = document.querySelector('#vvv-relay-command [data-relay-panel-generate]');
        if(effective){
            const busyLabel=active&&!value?`${runtime.activeGenerationOwner||'Yêu cầu trước đó'} đang chạy nốt ở nền…`:(label||'Đang sinh nội dung…');
            if(generate)generate.innerHTML=`<span>${esc(busyLabel)}</span><i class="vvv-relay-spinner">◌</i>`;
        }else{
            if(generate)generate.innerHTML=`<span>${runtime.lastError?'Sinh lại':'Sinh câu tiếp theo của tôi'}</span><i>→</i>`;
        }
        document.body.classList.toggle('vvv-relay-busy', effective);
    }

    function setRelayInlineError(message='') {
        runtime.lastError=String(message||'').trim();
        const node=document.querySelector('#vvv-relay-command [data-relay-inline-error]');
        if(node){node.textContent=runtime.lastError;node.hidden=!runtime.lastError;}
    }

    function showError(error) {
        runtime.busy = false;
        const message=String(error?.message || error || 'Tiếp sức cốt truyện bằng AI thất bại, hãy kiểm tra trạng thái API');
        setRelayInlineError(message);
        setBusy(false);
        console.error('[Tiếp sức cốt truyện bằng AI] Lượt này thất bại hoàn toàn', error);
        toast(message, 'error');
    }

    function preview() { return document.getElementById('vvv-relay-preview'); }

    function openPreview(text, customInput = '', anchor = runtime.draftAnchor) {
        closeCommandPanel();
        runtime.previewCustom=normalizeRelayCustomInput(customInput);
        runtime.draftAnchor=anchor?{...anchor}:null;
        let root = preview();
        if (!root) {
            root = document.createElement('div');
            root.id = 'vvv-relay-preview';
            root.innerHTML = `<div class="vvv-relay-backdrop"></div><section role="dialog"><header><b>Lượt nhập user kế tiếp do AI viết thay bạn</b><button type="button" data-close>×</button></header><textarea maxlength="20000"></textarea><small>Có thể sửa · nên viết 300-800 chữ · U1.4 mặc định không tự cắt (đặt là 0); mặc định không tự gửi</small><footer><button type="button" data-regen>Đổi bản khác / sinh lại</button><button type="button" data-fill>Điền vào ô nhập</button><button type="button" data-send>Gửi luôn</button><button type="button" data-cancel>Hủy</button></footer></section>`;
            document.body.appendChild(root);
            root.querySelector('[data-close]').onclick = () => closePreview(root);
            root.querySelector('[data-cancel]').onclick = () => closePreview(root);
            // Bộ xử lý sự kiện không còn giữ lại custom của “lần mở xem trước đầu tiên”, tránh việc dùng lại DOM rồi cứ lấy mãi hướng cũ.
            root.querySelector('[data-regen]').onclick = () => { const direction=runtime.previewCustom; closePreview(root); generateDraft(direction).catch(showError); };
            root.querySelector('[data-fill]').onclick = () => { try{fill(root.querySelector('textarea').value,runtime.draftAnchor);}catch(error){showError(error);} };
            root.querySelector('[data-send]').onclick = () => send(root.querySelector('textarea').value,runtime.draftAnchor).catch(showError);
        }
        root.querySelector('textarea').value = text;
        bindPreviewViewport(root);
    }

    function fill(value, expectedAnchor = runtime.draftAnchor) {
        if(expectedAnchor&&!relayAnchorIsCurrent(expectedAnchor))throw new Error('Sau khi sinh bản nháp, cuộc trò chuyện hoặc tầng AI mới nhất đã thay đổi; hãy sinh lại phần tiếp sức theo mạch truyện hiện tại');
        const input = document.querySelector('#send_textarea');
        if (!input) throw new Error('Không tìm thấy ô nhập liệu của SillyTavern');
        input.value = limitCompleteSentence(value);
        runtime.settings.pendingFateCard = null; saveSettings();
        input.dispatchEvent(new Event('input', { bubbles: true }));
        closePreview();
        toast('Đã điền vào ô nhập, bạn có thể sửa tiếp.', 'success');
    }

    async function send(value, expectedAnchor = runtime.draftAnchor) {
        const message = limitCompleteSentence(value);
        if (!message) throw new Error('Nội dung xem trước đang rỗng');
        if(expectedAnchor&&!relayAnchorIsCurrent(expectedAnchor))throw new Error('Sau khi sinh bản nháp, cuộc trò chuyện hoặc tầng AI mới nhất đã thay đổi; đã chặn việc gửi bản nháp cũ vào mạch truyện mới');
        const input = document.querySelector('#send_textarea');
        if (!input) throw new Error('Không tìm thấy ô nhập liệu của SillyTavern');
        const mod = await import('/script.js');
        if(expectedAnchor&&!relayAnchorIsCurrent(expectedAnchor))throw new Error('Trong lúc chuẩn bị gửi, cuộc trò chuyện hoặc tầng AI mới nhất đã thay đổi; đã hủy việc gửi');
        const generating = typeof mod.isGenerating === 'function' ? mod.isGenerating() : Boolean(mod.isGenerating);
        if (generating) throw new Error('Lượt trước vẫn đang được sinh');
        if (typeof mod.sendTextareaMessage !== 'function') throw new Error('Phiên bản SillyTavern hiện tại không hỗ trợ đường gửi tin thông thường');
        input.value = message;
        runtime.settings.pendingFateCard = null; saveSettings();
        input.dispatchEvent(new Event('input', { bubbles: true }));
        closePreview();
        closeCommandPanel();
        removeBars();
        runtime.selected.clear();
        // fixed13: khi gọi sendTextareaMessage bằng mã, ở một số tổ hợp ST/chủ đề nó chạy trước PromptManager của 0-09 và
        // gắn vào nhanh hơn, gây ra cảnh “gõ tay thì có chuỗi suy luận, còn chính văn char sau khi Tiếp sức AI gửi thì không có”.
        // Trước khi gửi hãy để 0-09 chuẩn bị sẵn cho lượt trả lời chính kế tiếp; sau đó vẫn dùng sendTextareaMessage gốc của SillyTavern, tuyệt đối không khởi động lần sinh thứ hai.
        try{
            await globalThis.VVVUnifiedCreative?.prepareRelayReply?.({text:message,source:'relay'});
        }catch(error){
            console.warn('[Tiếp sức cốt truyện bằng AI] Không chuẩn bị sẵn được preset sáng tác cho lượt trả lời chính; vẫn dùng đường gửi gốc và để generate_interceptor lo phần còn lại',error);
        }
        await mod.sendTextareaMessage();
        toast('Đã gửi theo đường thông thường của SillyTavern; lượt AI chính kế tiếp đã gắn chuỗi suy luận và preset hiện tại y như khi bạn gửi tay.', 'success');
    }

    function settingsModal() { return document.getElementById('vvv-relay-settings-modal'); }

    function relayConfigDefaults() {
        return {
            useMemoryApi: false,
            fallbackToPreset: false,
            sourcePolicyRevision: 4,
            provider: 'openai-compatible',
            baseUrl: '', apiKey: '', model: '', temperature: 0.35,
            maxTokens: 900, timeoutSeconds: 180, extraHeaders: {},
        };
    }

    async function refreshRelayServerConfig() {
        const data = await serverJson('/config');
        runtime.serverConfig = data.config || {};
        return { ...relayConfigDefaults(), ...(runtime.serverConfig.relay || {}) };
    }

    function readRelayApiForm(root) {
        let extraHeaders = {};
        const raw = String(root.querySelector('[data-api-headers]')?.value || '').trim();
        if (raw) {
            try { extraHeaders = JSON.parse(raw); }
            catch { throw new Error('Header bổ sung phải là JSON hợp lệ'); }
            if (!extraHeaders || typeof extraHeaders !== 'object' || Array.isArray(extraHeaders)) throw new Error('Header bổ sung phải là một đối tượng JSON');
        }
        return {
            useMemoryApi: false,
            fallbackToPreset: false,
            sourcePolicyRevision: 4,
            provider: String(root.querySelector('[data-api-provider]')?.value || 'openai-compatible'),
            baseUrl: String(root.querySelector('[data-api-base]')?.value || '').trim(),
            apiKey: String(root.querySelector('[data-api-key]')?.value || '').trim(),
            model: String(root.querySelector('[data-api-model]')?.value || '').trim(),
            temperature: Number(root.querySelector('[data-api-temp]')?.value || 0.35),
            maxTokens: Number(root.querySelector('[data-api-max]')?.value || 900),
            timeoutSeconds: Math.max(10,Math.min(1800,Number(root.querySelector('[data-api-timeout]')?.value || 180))),
            extraHeaders,
        };
    }

    function syncApiVisibility(root) {
        const wrap = root.querySelector('[data-independent-box]');
        const api = root.querySelector('[data-relay-api-fields]');
        if (wrap) wrap.hidden = false;
        if (api) api.hidden = false;
    }

    async function saveRelayServerConfig(root) {
        const relay = readRelayApiForm(root);
        const data = await serverJson('/config', { method: 'POST', body: JSON.stringify({ relay }) });
        runtime.serverConfig = data.config || runtime.serverConfig;
        return data.config?.relay || relay;
    }

    async function fetchRelayModels(root) {
        const status = root.querySelector('[data-model-status]');
        const picker = root.querySelector('[data-model-results]');
        const modelInput = root.querySelector('[data-api-model]');
        try {
            if (status) status.textContent = 'Đang lưu giao diện hiện tại và lấy danh sách mô hình…';
            await saveRelayServerConfig(root);
            const data = await serverJson('/relay/models');
            const models = [...new Set((Array.isArray(data?.models) ? data.models : []).map(v => String(v || '').trim()).filter(Boolean))]
                .sort((a,b) => a.localeCompare(b, undefined, { numeric:true, sensitivity:'base' }));
            if (!models.length) throw new Error('Giao diện không trả về mô hình nào dùng được; bạn vẫn có thể tự điền tên mô hình vào ô mô hình');
            if (picker) {
                picker.replaceChildren();
                const first = document.createElement('option');
                first.value = '';
                first.textContent = `Đã lấy được ${models.length} mô hình, bấm để chọn…`;
                picker.appendChild(first);
                for (const name of models) {
                    const option = document.createElement('option');
                    option.value = name;
                    option.textContent = name;
                    picker.appendChild(option);
                }
                picker.hidden = false;
                picker.value = models.includes(String(modelInput?.value || '').trim()) ? String(modelInput.value).trim() : '';
            }
            if (status) status.textContent = `✅ Đã lấy được ${models.length} mô hình; có thể chọn từ danh sách xổ xuống hoặc tiếp tục tự điền.`;
        } catch (error) {
            if (picker) picker.hidden = true;
            if (status) status.textContent = `⚠️ ${String(error?.message || error)}`;
        }
    }

    function timedRulesForTextarea() {
        const floor = currentFloorIndex();
        return (runtime.settings?.ledgerTimed || []).filter(item => Number(item.expiresFloor) > floor).map(item => {
            const remaining = Math.max(1, Number(item.expiresFloor) - floor);
            return `${item.text} | ${remaining}`;
        }).join('\n');
    }

    function parseTimedRulesTextarea(value) {
        const floor = currentFloorIndex();
        return String(value || '').split(/\r?\n/).map(line => {
            const raw = line.trim();
            if (!raw) return null;
            const match = raw.match(/^(.*?)(?:\s*\|\s*(\d{1,4}))?$/);
            const text = String(match?.[1] || raw).trim().slice(0,500);
            const remaining = Math.max(1, Math.min(1000, Number(match?.[2] || 10)));
            return text ? { text, expiresFloor:floor + remaining } : null;
        }).filter(Boolean).slice(0, 80);
    }

    async function openSettings() {
        globalThis.VVVUnifiedCore?.overlays?.activate?.('relay');
        let root = settingsModal();
        if (!root) {
            root = document.createElement('div');
            root.id = 'vvv-relay-settings-modal';
            root.innerHTML = `<div class="vvv-relay-backdrop"></div><section><header><b>0-32 · Cài đặt Tiếp sức cốt truyện bằng AI</b><button type="button" data-close>×</button></header>
                <label><input type="checkbox" data-enabled>Bật nút “Tiếp sức 0-32” thường trực cạnh nút gửi (khuyên dùng)</label>
                <label>Nguồn viết<select data-mode disabled><option value="independent" selected>API riêng · tư liệu cốt truyện hữu hạn</option></select></label>
                <label><input type="checkbox" data-direct>Gửi ngay sau khi sinh nội dung (mặc định tắt)</label>
                <label>Phạm vi nguyên văn gần đây<select data-recent-floors><option value="8">8 tầng gần nhất</option><option value="12">12 tầng gần nhất</option><option value="16">16 tầng gần nhất (khuyên dùng)</option><option value="24">24 tầng gần nhất</option><option value="32">32 tầng gần nhất</option></select></label>
                <label>Số lần tự thử lại khi thất bại<input type="number" min="1" max="6" step="1" data-retry-attempts></label>
                <label>Số lần sửa khi bị lặp lại chỉ thị<input type="number" min="1" max="6" step="1" data-repair-attempts></label>
                <label>Số ký tự tối đa cho phần tiếp sức<input type="number" min="0" max="20000" step="100" data-max-chars><small>0 = không tự cắt; có thể đặt 1000/2000/4000/8000.</small></label>
                <label><input type="checkbox" data-anti-truncation>Bật tự viết tiếp để chống bị cắt cụt (khuyên dùng)</label>
                <label>Số đoạn tự viết tiếp tối đa<input type="number" min="1" max="6" step="1" data-continuation-max><small>Khi phát hiện mô hình bị cắt do chạm giới hạn token hoặc câu chưa khép, sẽ gọi tiếp cùng một API tiếp sức rồi ghép lại và loại phần trùng.</small></label>
                <div class="vvv-relay-api-box vvv-relay-control-settings">
                    <h3>✒️ Lớp điều khiển 0-32</h3>
                    <label><input type="checkbox" data-director-enabled>Bật Đạo diễn cốt truyện (gợi ý đạo diễn cục bộ, không gọi thêm API)</label>
                    <div class="vvv-relay-director-scope">
                        <span>Phạm vi tác động của Đạo diễn cốt truyện:</span>
                        <label><input type="checkbox" data-director-main>Câu trả lời thường của AI chính trong SillyTavern (khuyên dùng)</label>
                        <label><input type="checkbox" data-director-relay>Tiếp sức cốt truyện bằng AI của 0-32</label>
                        <small>Tích cả hai = dùng cho cả hai phía. Đạo diễn cho AI chính cho phép {{char}}/NPC hành động và đáp lời bình thường, nhưng không hành động thay user; Đạo diễn cho phần tiếp sức vẫn chỉ viết về user.</small>
                    </div>
                    <label><input type="checkbox" data-fate-enabled>Bật bể thẻ định mệnh</label>
                    <label><input type="checkbox" data-fate-auto>Tự động gieo thẻ định mệnh theo chu kỳ</label>
                    <label><span>Chu kỳ rút thẻ tự động</span><select data-fate-interval><option value="4">4 lượt</option><option value="6">6 lượt</option><option value="8">8 lượt (khuyên dùng)</option><option value="10">10 lượt</option><option value="12">12 lượt</option><option value="16">16 lượt</option><option value="20">20 lượt</option></select></label>
                    <div class="vvv-relay-fate-cats"><span>Bật các bể thẻ:</span>${Object.entries(FATE_CATEGORY_LABELS).filter(([key])=>key!=='custom').map(([key,label])=>`<label><input type="checkbox" data-fate-cat="${key}">${label}</label>`).join('')}</div>
                    <label class="vvv-relay-wide"><span>Thẻ định mệnh tùy chỉnh (mỗi dòng: mã phân loại tiếng Anh | nội dung thẻ; cũng có thể chỉ ghi nội dung)</span><textarea data-custom-fate placeholder="Ví dụ: emotion|một lời hẹn quan trọng trong quá khứ được nhắc lại rất nhẹ nhàng"></textarea></label>
                </div>
                <div class="vvv-relay-api-box vvv-relay-ledger-settings">
                    <h3>📖 Sổ cái quy tắc 0-32</h3>
                    <label class="vvv-relay-wide"><span>Quy tắc dài hạn (mỗi dòng một quy tắc, luôn có hiệu lực)</span><textarea data-ledger-long placeholder="Ví dụ: đừng tha thứ cho ai thay user"></textarea></label>
                    <label class="vvv-relay-wide"><span>Quy tắc của chương hiện tại (mỗi dòng một quy tắc, tự xóa bằng tay)</span><textarea data-ledger-chapter placeholder="Ví dụ: chương này không được đột ngột tỏ tình, cũng đừng nhảy thời gian"></textarea></label>
                    <label class="vvv-relay-wide"><span>Quy tắc tạm thời (mỗi dòng: quy tắc | số tầng còn lại)</span><textarea data-ledger-timed placeholder="Ví dụ: chân bị thương không chạy được | 10"></textarea></label>
                    <small>Sổ cái quy tắc không chỉ dùng cho Tiếp sức cốt truyện bằng AI; Trung tâm Ký ức 0-32 cũng chèn nó vào mạch truyện chính thông thường. Quy tắc tạm thời sẽ tự được dọn khi hết hạn.</small>
                </div>
                <div class="vvv-relay-api-box vvv-relay-singleapi-settings">
                    <h3>🛡 Ranh giới của nguồn độc lập</h3>
                    <p><b>Luôn bật:</b> chỉ gọi API riêng của phần tiếp sức; khi thất bại thì thử lại chính nguồn độc lập đó theo “Số lần tự thử lại khi thất bại”, không gọi API chính của SillyTavern.</p>
                    <small>Nếu nhà cung cấp từ chối rõ ràng theo chính sách thì dừng luôn, không tự đổi nguồn để lách.</small>
                </div>
                <div class="vvv-relay-api-box" data-independent-box>
                    <p><b>API dành riêng cho Tiếp sức AI:</b> bộ Base URL, khóa và mô hình này chỉ phục vụ Tiếp sức AI, không dùng lại API sắp xếp/tổng kết và cũng không dùng chung với Bảy điều hậu trường. Yêu cầu chỉ mang theo phần cốt truyện gần đây, ký ức có cấu trúc và các quy tắc rõ ràng do chính mô-đun này chuẩn bị.</p>
                    <div data-relay-api-fields>
                        <label><span>Loại giao diện</span><select data-api-provider><option value="openai-compatible">Tương thích OpenAI</option><option value="anthropic">Anthropic</option><option value="gemini">Gemini</option></select></label>
                        <label><span>Base URL</span><input type="text" data-api-base autocomplete="off" placeholder="Ví dụ: https://example.com/v1"></label>
                        <label><span>API Key</span><input type="password" data-api-key autocomplete="off" placeholder="Để trống để giữ khóa đã lưu trên máy chủ"></label>
                        <label class="vvv-relay-model-field"><span>Mô hình</span><div class="vvv-relay-model-row"><input type="text" data-api-model autocomplete="off" placeholder="Có thể tự điền, hoặc bấm nút bên phải để lấy danh sách mô hình"><button type="button" data-fetch-models>Lấy mô hình</button></div><select data-model-results hidden><option value="">Chọn mô hình đã lấy được…</option></select><small data-model-status></small></label>
                        <label><span>Temperature</span><input type="number" min="0" max="2" step="0.05" data-api-temp></label>
                        <label><span>Token đầu ra tối đa</span><input type="number" min="128" max="8000" data-api-max></label>
                        <label><span>Thời gian chờ (giây)</span><input type="number" min="10" max="1800" data-api-timeout></label>
                        <label class="vvv-relay-wide"><span>Header bổ sung dạng JSON</span><textarea data-api-headers spellcheck="false" placeholder="{}"></textarea></label>
                        <div class="vvv-relay-api-actions vvv-relay-wide"><button type="button" data-fetch-models-secondary>↻ Lấy danh sách mô hình</button><button type="button" data-test-api>✓ Kiểm tra toàn tuyến</button></div>
                    </div>
                </div>
                <p>Tiếp sức AI không đọc preset, sách thế giới, Persona hay Prompt Manager của SillyTavern; khi API riêng thất bại cũng không chuyển sang API chính của SillyTavern.</p>
                <small data-config-status>Đang đọc cấu hình API tiếp sức của tài khoản này…</small>
                <footer><button type="button" data-save>Lưu</button></footer></section>`;
            document.body.appendChild(root);
            root.querySelector('[data-close]').onclick = () => root.remove();
            root.querySelector('[data-fetch-models]')?.addEventListener('click', () => fetchRelayModels(root));
            root.querySelector('[data-fetch-models-secondary]')?.addEventListener('click', () => fetchRelayModels(root));
            root.querySelector('[data-model-results]')?.addEventListener('change', event => {
                const value = String(event.currentTarget?.value || '').trim();
                if (value) root.querySelector('[data-api-model]').value = value;
            });
            root.querySelector('[data-test-api]').onclick = async () => {
                const status = root.querySelector('[data-config-status]');
                try {
                    status.textContent = 'Đang lưu và kiểm tra…';
                    await saveRelayServerConfig(root);
                    const result = await generateWithConfiguredApi('Đây là bài kiểm tra toàn tuyến của Tiếp sức AI. Chỉ trả lời một câu văn bản thử ngắn gọn của user.', { owner:'Kiểm tra cài đặt Tiếp sức AI', systemPrompt:'Đây là bài kiểm tra kết nối, không viết cốt truyện thật.', responseLength:256, deadlineAt:Date.now()+180000 });
                    status.textContent = `✅ ${runtime.lastGenerationSourceLabel||configuredSourceLabel()}：${String(result || 'Kết nối thành công').slice(0, 120)}`;
                } catch (error) {
                    status.textContent = `❌ ${String(error?.message || error)}`;
                }
            };
            root.querySelector('[data-save]').onclick = async () => {
                const status = root.querySelector('[data-config-status]');
                try {
                    runtime.settings.enabled = root.querySelector('[data-enabled]').checked;
                    runtime.settings.mode = 'independent';
                    runtime.settings.directAfterGenerate = root.querySelector('[data-direct]').checked;
                    runtime.settings.recentFloors = Number(root.querySelector('[data-recent-floors]').value || 16);
                    runtime.settings.relayRetryAttempts = Math.max(1,Math.min(6,Number(root.querySelector('[data-retry-attempts]')?.value||4)));
                    runtime.settings.relayRepairAttempts = Math.max(1,Math.min(6,Number(root.querySelector('[data-repair-attempts]')?.value||3)));
                    runtime.settings.relayMaxChars = Math.max(0,Math.min(20000,Number(root.querySelector('[data-max-chars]')?.value||0)));
                    runtime.settings.relayAntiTruncation = root.querySelector('[data-anti-truncation]').checked;
                    runtime.settings.relayContinuationMax = Math.max(1,Math.min(6,Number(root.querySelector('[data-continuation-max]')?.value||3)));
                    runtime.settings.directorEnabled = root.querySelector('[data-director-enabled]').checked;
                    runtime.settings.directorMainEnabled = root.querySelector('[data-director-main]').checked;
                    runtime.settings.directorRelayEnabled = root.querySelector('[data-director-relay]').checked;
                    runtime.settings.fateEnabled = root.querySelector('[data-fate-enabled]').checked;
                    runtime.settings.fateAutoEnabled = root.querySelector('[data-fate-auto]').checked;
                    runtime.settings.fateInterval = Number(root.querySelector('[data-fate-interval]').value || 8);
                    runtime.settings.fateCategories = [...root.querySelectorAll('[data-fate-cat]:checked')].map(node => node.dataset.fateCat);
                    runtime.settings.customFateCards = String(root.querySelector('[data-custom-fate]').value || '').trim();
                    runtime.settings.ledgerLong = String(root.querySelector('[data-ledger-long]').value || '').trim();
                    runtime.settings.ledgerChapter = String(root.querySelector('[data-ledger-chapter]').value || '').trim();
                    runtime.settings.ledgerTimed = parseTimedRulesTextarea(root.querySelector('[data-ledger-timed]').value);
                    runtime.settings.multiFlashEnabled = false;
                    saveSettings();
                    await saveRelayServerConfig(root);
                    closeSettingsModal(root);
                    if (runtime.settings.enabled) restoreBar({ settled: true });
                    else removeBars();
                    toast('Đã lưu cài đặt tiếp sức.', 'success');
                } catch (error) {
                    status.textContent = `❌ ${String(error?.message || error)}`;
                }
            };
        }

        root.querySelector('[data-enabled]').checked = runtime.settings.enabled;
        root.querySelector('[data-mode]').value = 'independent';
        root.querySelector('[data-direct]').checked = runtime.settings.directAfterGenerate;
        root.querySelector('[data-recent-floors]').value = String(normalizedRecentFloorCount());
        root.querySelector('[data-retry-attempts]').value = String(relayRetryAttempts());
        root.querySelector('[data-repair-attempts]').value = String(relayRepairAttempts());
        root.querySelector('[data-max-chars]').value = String(relayMaxChars());
        root.querySelector('[data-anti-truncation]').checked = runtime.settings.relayAntiTruncation !== false;
        root.querySelector('[data-continuation-max]').value = String(relayContinuationLimit());
        root.querySelector('[data-director-enabled]').checked = runtime.settings.directorEnabled !== false;
        root.querySelector('[data-director-main]').checked = runtime.settings.directorMainEnabled !== false;
        root.querySelector('[data-director-relay]').checked = runtime.settings.directorRelayEnabled !== false;
        root.querySelector('[data-fate-enabled]').checked = runtime.settings.fateEnabled !== false;
        root.querySelector('[data-fate-auto]').checked = Boolean(runtime.settings.fateAutoEnabled);
        root.querySelector('[data-fate-interval]').value = String(runtime.settings.fateInterval || 8);
        root.querySelectorAll('[data-fate-cat]').forEach(node => { node.checked = (runtime.settings.fateCategories || []).includes(node.dataset.fateCat); });
        root.querySelector('[data-custom-fate]').value = String(runtime.settings.customFateCards || '');
        root.querySelector('[data-ledger-long]').value = String(runtime.settings.ledgerLong || '');
        root.querySelector('[data-ledger-chapter]').value = String(runtime.settings.ledgerChapter || '');
        root.querySelector('[data-ledger-timed]').value = timedRulesForTextarea();
        const status = root.querySelector('[data-config-status]');
        try {
            const relay = await refreshRelayServerConfig();
            root.querySelector('[data-api-provider]').value = relay.provider || 'openai-compatible';
            root.querySelector('[data-api-base]').value = relay.baseUrl || '';
            root.querySelector('[data-api-key]').value = '';
            root.querySelector('[data-api-model]').value = relay.model || '';
            root.querySelector('[data-api-temp]').value = Number(relay.temperature ?? 0.35);
            root.querySelector('[data-api-max]').value = Number(relay.maxTokens || 1600);
            root.querySelector('[data-api-timeout]').value = Number(relay.timeoutSeconds || 180);
            root.querySelector('[data-api-headers]').value = JSON.stringify(relay.extraHeaders || {}, null, 2);
            status.textContent = relay.apiKeyConfigured ? '🔐 Đã lưu khóa API riêng của phần tiếp sức; khi thất bại chỉ thử lại chính nguồn độc lập đó.' : 'API riêng của phần tiếp sức chưa lưu khóa; hãy cấu hình Base URL, mô hình và khóa trước.';
        } catch (error) {
            status.textContent = `⚠️ Không đọc được cấu hình tiếp sức trên máy chủ: ${String(error?.message || error)}`;
        }
        syncApiVisibility(root);
        bindSettingsViewport(root);
    }

    function ensureEntry() {
        if (globalThis.__VVV_UNIFIED_MODE__) return;
        if (document.getElementById('vvv-relay-settings-entry')) return;
        const host = document.querySelector('#extensions_settings') || document.body;
        const box = document.createElement('div');
        box.id = 'vvv-relay-settings-entry';
        box.className = 'inline-drawer';
        box.innerHTML = `<div class="inline-drawer-toggle inline-drawer-header"><b>✦ Tiếp sức cốt truyện bằng AI</b></div><div class="inline-drawer-content"><p>U1.7.15: Tiếp sức AI vẫn dùng API riêng; API thời gian thực của điện thoại cũng giữ độc lập, không dùng lẫn kết nối của phần tổng kết hay Bảy điều hậu trường.</p><button type="button">Mở cài đặt tiếp sức</button><small>Phiên bản ${VERSION}</small></div>`;
        box.querySelector('button').onclick = () => openSettings().catch(showError);
        host.appendChild(box);
    }

    function onSettled(event) {
        const detail = event.detail || {};
        if (!detail.signature || runtime.settled.has(detail.signature)) return;
        runtime.settled.add(detail.signature);
        if (runtime.settled.size > 240) runtime.settled.delete(runtime.settled.values().next().value);
        const settledEntry = latestAssistant();
        runtime.commandAnchor = null;
        runtime.generationStartAnchor = null;
        runtime.stopRecoveryAnchor = null;
        if (settledEntry) runtime.stoppedPartialFingerprints.delete(entryFingerprint(settledEntry));
        runtime.currentSignature = signature(settledEntry);
        runtime.barDesired = Boolean(runtime.currentSignature);
        if (settledEntry) rememberSettledAnchor(settledEntry);
        runtime.currentFateCard = null;
        if (runtime.settings?.pendingFateCard) { runtime.settings.pendingFateCard = null; saveSettings(); }
        runtime.selected.clear();
        setDockBusy(false);
        restoreBar({ settled: true, entryOverride: settledEntry });
        // Một số chủ đề/tầng vuốt vẫn thay DOM của tầng cuối sau khi đã settled; vài lần xác nhận nhẹ chỉ bù lại UI, không gọi API.
        setTimeout(() => scheduleBarRestore(0), 180);
        setTimeout(() => scheduleBarRestore(0), 650);
        setTimeout(() => scheduleBarRestore(0), 1500);
    }

    function clearForNewUserTurn() {
        runtime.selected.clear();
        runtime.draft='';
        runtime.draftAnchor=null;
        runtime.previewCustom='';
        runtime.currentSignature = '';
        runtime.barDesired = false;
        clearTimeout(runtime.restoreTimer);
        removeBars();
        closePreview();
        closeCommandPanel();
        ensureDockButton();
    }

    function clearForRealGenerationStart() {
        // Việc sinh nội dung ngầm hoặc generation nền của tiện ích khác không được xóa nhầm thanh tiếp sức đã settled.
        // Chỉ khi tin nhắn thật cuối cùng của cuộc trò chuyện hiện tại đúng là của user thì mới coi là bắt đầu một lượt chính văn mới.
        const chat = ctx()?.chat;
        if (!Array.isArray(chat)) return;
        for (let i = chat.length - 1; i >= 0; i -= 1) {
            const message = chat[i];
            if (!message || message.is_system || !textOf(message)) continue;
            if (message.is_user) {
                // P22: lượt sinh nội dung mới bắt buộc lấy “câu trả lời AI hoàn chỉnh gần nhất trước tin user này” làm điểm gốc.
                // lastSettledAnchor chỉ là phương án dự phòng, tuyệt đối không được lấn quyền cấu trúc chat hiện tại.
                const anchorEntry = latestSafeAssistant({ beforeIndex:i }) || assistantBeforeLatestUser() || anchoredEntry();
                runtime.stopRecoveryAnchor = null;
                if (anchorEntry) runtime.generationStartAnchor = anchorFromEntry(anchorEntry);
                else runtime.generationStartAnchor = null;
                clearForNewUserTurn();
                setDockBusy(true);
                if (runtime.generationStartAnchor) startGenerationStopWatch();
            }
            return;
        }
    }


    function restoreAfterGenerationStopped(_event = null) {
        clearGenerationWatch();
        const stoppedBase = runtime.generationStartAnchor ? { ...runtime.generationStartAnchor } : null;
        markStoppedPartials(stoppedBase);
        runtime.stopRecoveryAnchor = stoppedBase;
        // Mấu chốt: xử lý STOP xong phải xóa ngay generationStartAnchor, tránh việc về sau nó kéo phần tiếp sức về tầng cũ mãi mãi.
        runtime.generationStartAnchor = null;
        runtime.busy = false;
        runtime.selected.clear();
        setDockBusy(false);
        ensureDockButton();
        closeCommandPanel();
        preview()?.remove();

        const attempt = (delay, reveal = false) => setTimeout(() => {
            const entry = entryForDock() || looseEntryFromAnchor(runtime.stopRecoveryAnchor) || recoverableAnchorEntry();
            if (!entry || !runtime.settings?.enabled) return;
            runtime.currentSignature = signature(entry);
            runtime.barDesired = true;
            // Khi khôi phục thì ghi lại một mốc neo nới lỏng; việc dọn chính văn hay bóc phần bao ở cuối làm đổi hash văn bản cũng không còn làm mất lối vào.
            runtime.lastSettledAnchor = anchorFromEntry(entry);
            restoreBar({ settled:false, entryOverride:entry, force:true });
            if (reveal) {
                const node = ensureDockButton();
                try { node?.animate?.([{transform:'scale(1)'},{transform:'scale(1.08)'},{transform:'scale(1)'}], {duration:260}); } catch {}
            }
        }, delay);

        attempt(60, false);
        attempt(220, true);
        attempt(700, false);
        attempt(1500, false);
    }

    function restoreAfterGenerationEndedIfEmpty() {
        // Thứ tự sự kiện “dừng” có thể khác nhau giữa các phiên bản/chủ đề chính thức.
        // Nếu sau ENDED mà tin nhắn thật cuối cùng vẫn là của user thì nghĩa là chưa có chính văn AI hoàn chỉnh nào rơi xuống, xử lý như bị ngắt.
        setTimeout(() => {
            const last = latestRealMessage();
            if (last?.message?.is_user && runtime.generationStartAnchor) {
                restoreAfterGenerationStopped({ source:'ended-empty' });
            } else {
                // Ngay cả khi VVV_TURN_SETTLED bị bỏ sót do chủ đề/thứ tự thời gian, một lượt hoàn tất bình thường vẫn phải giải phóng mốc neo sinh nội dung cũ.
                runtime.generationStartAnchor = null;
                runtime.stopRecoveryAnchor = null;
                setDockBusy(false);
                ensureDockButton();
                clearGenerationWatch();
            }
        }, 120);
    }


    async function initialize() {
        removeLegacyPerspectiveStyle();
        for (let i = 0; i < 80 && !ctx(); i += 1) await new Promise(resolve => setTimeout(resolve, 250));
        if (!ctx()) return;
        loadSettings();
        try { await refreshRelayServerConfig(); }
        catch (error) { console.warn('[Tiếp sức cốt truyện bằng AI] Chưa đọc được cấu hình API riêng; khi sinh nội dung thật máy chủ sẽ kiểm tra lại', error); }
        runtime.configuredSourceReady = true;
        ensureEntry();
        globalThis.addEventListener('VVV_TURN_SETTLED', onSettled);
        const c = ctx();
        const source = c?.eventSource;
        const types = c?.eventTypes || c?.event_types || globalThis.event_types || {};
        const bus=globalThis.VVVUnifiedCore?.events;
        const on=(name,handler)=>{if(bus?.on)return bus.on(name,handler);const actual=types?.[name]||name;source?.on?.(actual,handler);return()=>{};};
        // U1.4: các sự kiện gốc được giao hết cho EventBus của 0-00; mô-đun này không đăng ký trùng với SillyTavern nữa.
        on('USER_MESSAGE_RENDERED', clearForNewUserTurn);
        on('GENERATION_STARTED', clearForRealGenerationStart);
        // R9S1P17: ba lớp bảo hiểm — sự kiện STOPPED + ENDED trả về rỗng + watchdog isGenerating.
        on('GENERATION_STOPPED', restoreAfterGenerationStopped);
        on('GENERATION_ENDED', restoreAfterGenerationEndedIfEmpty);
        on('CHAT_CHANGED', () => {
            runtime.selected.clear();
            runtime.currentSignature = '';
            runtime.barDesired = false;
            runtime.lastSettledAnchor = null;
            runtime.generationStartAnchor = null;
            runtime.stopRecoveryAnchor = null;
            runtime.stoppedPartialFingerprints.clear();
            runtime.commandAnchor = null;
            runtime.draft='';
            runtime.draftAnchor=null;
            runtime.previewCustom='';
            runtime.lastCustomDirection='';
            clearGenerationWatch();
            runtime.currentFateCard = null;
            removeBars();
            setDockBusy(false);
            ensureDockButton();
            preview()?.remove();
            closeCommandPanel();
            setTimeout(() => {
                const entry = latestAssistant();
                runtime.currentSignature = signature(entry);
                runtime.barDesired = Boolean(runtime.currentSignature);
                if (entry) rememberSettledAnchor(entry);
                restoreBar({ settled: true, entryOverride: entry });
            }, 700);
        });
        installBarObserver();
        // Tải lại/mở lại chỉ khôi phục phần UI dưới chân chính văn AI mới nhất, không gọi mô hình.
        setTimeout(() => {
            const entry = latestAssistant();
            runtime.currentSignature = signature(entry);
            runtime.barDesired = Boolean(runtime.currentSignature);
            if (entry) rememberSettledAnchor(entry);
            restoreBar({ settled: true, entryOverride: entry });
            installBarObserver();
        }, 900);
        console.log(`[${ID}] v${VERSION} ready; persistent send-dock relay button + premium command panel`);
    }

    globalThis.VVVUnifiedCore?.overlays?.register?.('relay',{close:()=>{closeCommandPanel();closePreview();settingsModal()?.remove();}});
    globalThis.VVVUnifiedRelay = Object.assign(globalThis.VVVUnifiedRelay || {}, {
        version: VERSION,
        openCommand: () => openCommandPanel(),
        // Bản đồ cốt truyện chỉ mở ra một hướng xuất phát tùy chỉnh, không mở bảng chọn hướng thường hay thẻ định mệnh.
        generateTravel: (custom = '') => {
            runtime.selected.clear();
            runtime.selected.add('custom');
            runtime.currentFateCard = null;
            return generateDraft(String(custom || '').slice(0, 1200));
        },
        openSettings: () => openSettings(),
        generateWithConfiguredApi: (prompt, options = {}) => generateWithConfiguredApi(prompt, options),
        isConfiguredSourceReady: () => runtime.configuredSourceReady === true,
        configuredSourceMode: () => configuredSourceMode(),
        configuredSourceLabel: () => configuredSourceLabel(),
        lastGenerationSource: () => ({source:runtime.lastGenerationSource,label:runtime.lastGenerationSourceLabel,pipeline:runtime.lastPipelineDebug}),
        close: () => { closeCommandPanel(); closePreview(); },
    });

    initialize().catch(showError);
})();
