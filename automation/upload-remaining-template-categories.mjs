import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_BASE = process.env.JIBIAN_API_BASE_URL ?? "https://api.jibian.art";
const PRICE_CREDITS = 6;
const RESULT_COUNT = 1;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const envPath = path.join(projectRoot, "Backend", ".env");
const imageDir = path.join(projectRoot, "Design", "images");
const manifestDir = path.join(projectRoot, "Design", "template_uploads");

const IDENTITY_RULE =
  "保留图中主要主体的核心识别特征；如果主体是人物，保留真实五官结构、脸型、年龄段、发型轮廓和主要身份特征；如果主体是宠物、物品或其他对象，保留类别、外形轮廓、颜色、材质和关键细节。";

const NEGATIVE_RULE =
  "不要改变图中主要主体的身份、类别和关键识别特征；如果主体是人物，不要生成明星脸，不要夸张改变五官，不要过度磨皮，不要暴露或擦边服装；如果主体是宠物、物品或其他对象，不要改成无关品类或丢失原有外形特征。不要出现文字、水印、logo、畸形手指、扭曲五官、额外主体、重复身体、低清晰度、脏乱背景或明显 AI 感。";

const packs = {
  beauty_business: {
    category: "💄 变美营业",
    manifestPrefix: "beauty_business_upload",
    templates: [
      ["清透上镜营业", "清透上镜的自然营业照", "主体以近景或半身构图呈现，状态松弛但精神，人物可呈现干净底妆、柔顺发丝和日常精致服装；非人物主体则强化干净轮廓、细腻材质和整洁陈列。背景为浅色棚拍、窗边或简洁生活空间，使用柔和漫射光、低饱和奶油色和轻微真实肤质细节，适合社交头像和个人主页展示。"],
      ["镜前好状态", "像刚完成妆造后的好状态照片", "主体位于画面中心，以正面或微侧身角度呈现，整体感觉清爽、明亮、有亲和力。人物妆容强调自然气色、清晰眼神和不过度修饰的真实皮肤；非人物主体则呈现被认真整理后的高级展示感。背景干净，有轻微景深和柔光反射，像真实摄影师拍摄的精修成片。"],
      ["温柔奶油光", "温柔奶油光质感的精致照片", "主体以近景、半身或完整主体构图呈现，画面有柔和包裹感。人物可搭配浅色针织、衬衫或简洁配饰，妆容干净自然；非人物主体则保留原有材质并加入温柔光泽。背景为米白、浅杏或浅灰空间，光线像窗边自然光，整体明亮、细腻、适合朋友圈和小红书发布。"],
      ["韩系通勤妆", "韩系通勤感的清爽营业照", "主体以半身或七分身构图呈现，姿态自然利落。人物可呈现低饱和通勤穿搭、清透底妆、自然眉眼和简洁发型；非人物主体则以干净陈列和柔和背景表现通勤生活方式。背景为咖啡馆、办公楼窗边或浅色室内，使用自然柔光和细腻景深，整体不过分甜腻也不夸张。"],
      ["冷感高级照", "冷感干净的高级社交展示照", "主体以稳定的中心构图或轻微留白构图呈现，气质克制、清晰、有距离感。人物服装以黑白灰、深蓝或低饱和色为主，妆容强调轮廓和真实质感；非人物主体则增强形体边缘和材质层次。背景为灰调室内、玻璃墙或极简街景，光线柔和偏冷，适合个人主页主图。"],
      ["精致出门照", "像出门前随手拍但很精致的生活照片", "主体以近景或半身构图呈现，动作自然，画面有轻松生活感。人物可呈现日常发型、干净妆容和有质感的出门穿搭；非人物主体则像被放在生活方式场景中拍摄。背景为玄关、街角、咖啡店门口或电梯镜前氛围，色彩明亮但不刺眼，像真实手机摄影精修图。"],
      ["午后棚拍感", "午后柔光棚拍质感的精致形象照", "主体以半身或三分之二构图呈现，姿态稳定、表情自然。人物造型以轻盈发丝、自然妆容和干净服饰为主；非人物主体则强调轮廓、质地和被柔光照亮的层次。背景为浅灰、米白或柔和渐变布景，使用大面积柔光和细腻阴影，画面有杂志棚拍完成度。"],
      ["低饱和妆造", "低饱和高级妆造感照片", "主体构图清楚，背景不抢主体。人物妆造强调自然修容、清晰眼神、低饱和服饰和不过度网红化的精致感；非人物主体则保留原有颜色并统一为低饱和视觉系统。场景可为室内布景、街边橱窗或浅色墙面，整体色彩柔和、层次清楚、像可发布的小红书首图。"],
      ["白衬衫氛围", "白衬衫或浅色简洁造型的清透照片", "主体以半身、近景或完整主体构图呈现，画面干净、有呼吸感。人物可呈现白衬衫、浅色上衣或简洁外套，妆容自然、发型利落；非人物主体则使用白色或浅色环境衬托原有形体。背景为窗边、白墙或浅木色空间，光线柔和，整体适合头像、主页和社交展示。"],
      ["花店柔光", "花店或自然花艺环境里的柔光营业照", "主体以近景或半身构图呈现，周围有适度花材、绿植或柔和色块，但不遮挡主体。人物造型自然清新，妆容强调气色和温柔感；非人物主体则与花艺环境形成生活方式画面。背景明亮、有浅景深和自然散射光，整体清透、精致、适合分享。"],
      ["杂志感半身", "杂志感半身形象大片", "主体以半身或七分身构图呈现，姿态自然但有镜头表现力。人物服饰简洁有廓形，妆发干净、不过度夸张；非人物主体则以杂志静物拍摄方式呈现。背景为低饱和纯色、布景或现代室内，光线有方向但不过硬，整体有编辑部成片质感。"],
      ["气色拉满", "自然提亮气色的社交展示照片", "主体以近景或半身构图呈现，画面重点是精神状态、清晰眼神和健康光泽。人物可呈现自然红润、干净底妆和柔顺发型；非人物主体则提升色彩明度和材质洁净度。背景简洁明亮，使用柔和自然光和浅暖色调，像真实修图师轻修后的好状态照片。"],
      ["法式松弛照", "法式松弛感的精致生活照片", "主体以半身、七分身或完整主体构图呈现，动作松弛、不过度摆拍。人物可搭配简洁衬衫、针织、风衣或低饱和配饰，妆发自然；非人物主体则呈现法式生活方式静物感。背景为街边咖啡馆、窗边餐桌或浅色老建筑，色彩温柔，有轻微胶片颗粒。"],
      ["城市约拍感", "城市约拍质感的自然营业照", "主体出现在街角、玻璃橱窗、浅色建筑或安静人行道前，以半身或七分身构图呈现。人物穿搭干净有层次，妆容自然上镜；非人物主体则被放入城市生活场景中拍摄。光线为傍晚柔光或阴天漫射光，整体真实、清爽、有摄影师跟拍感。"],
      ["干净底妆感", "干净底妆和柔和光线主导的精修照片", "主体以近景或半身构图呈现，保留真实纹理，不做塑料感磨皮。人物妆容强调均匀肤色、自然眉眼和清楚面部层次；非人物主体则强调表面洁净、材质细节和柔和高光。背景简约，使用柔光和低对比阴影，画面适合头像与社交主页。"],
      ["轻甜发光照", "轻甜但不幼稚的发光感照片", "主体以近景、半身或完整主体构图呈现，整体明亮、干净、有亲和力。人物可呈现自然微笑、浅色穿搭和轻盈发丝；非人物主体则加入柔和高光和清新环境。背景为窗边、花园、浅色室内或日光街角，色彩偏暖但不过曝，适合分享和保存。"],
      ["自然精修照", "自然精修后的真实摄影成片", "主体构图稳定，整体像真实摄影师拍摄后做了适度修图。人物保留真实皮肤质感、五官比例和自然表情，只优化光线、色彩和画面整洁度；非人物主体则增强清晰度、材质和背景层次。背景可为室内或户外低干扰场景，成片干净耐看。"],
      ["明亮生活妆", "明亮生活妆造感照片", "主体以半身或近景构图呈现，画面强调自然光、轻妆造和日常可用性。人物可呈现清透妆容、简洁耳饰或发型细节；非人物主体则通过明亮环境和生活化布置提高可看性。背景为家居、咖啡馆、花店或街角，整体像可以直接发朋友圈的生活方式照片。"],
      ["温柔侧光照", "温柔侧光营造的精致氛围照片", "主体以近景、半身或完整主体构图呈现，侧光勾勒轮廓并保留清晰细节。人物妆发自然，服饰以低饱和浅色或深色简洁款为主；非人物主体则强调边缘高光、体积感和材质层次。背景简洁有景深，整体细腻、安静、适合社交展示。"],
      ["不费力高级感", "不费力但有完成度的高级照片", "主体以自然站姿、坐姿或稳定展示角度呈现，画面不过度摆拍。人物造型干净、有质感，妆容克制；非人物主体则以高级静物或生活方式拍摄方式呈现。背景为低饱和城市、室内或浅色空间，光线柔和，整体像真实高质量约拍成片。"],
    ],
  },
  role_play: {
    category: "🪄 角色入戏",
    manifestPrefix: "role_play_upload",
    templates: [
      ["银翼调查员", "未来城市里的银翼调查员角色海报", "主体以半身或七分身构图出现，姿态冷静、有任务感。人物可穿深色机能外套、金属配件和简洁战术元素；非人物主体则转化为未来道具或角色伙伴，但保留原本形态。背景为雨夜霓虹、玻璃高楼和蓝紫色城市光影，整体电影感强，像科幻剧集角色宣传照。"],
      ["古风游侠", "古风江湖游侠角色照", "主体以半身、七分身或完整主体构图呈现，动作自然、有行走江湖的故事感。人物可穿素雅侠客服饰、束发或披发、少量皮革与布料层次；非人物主体则作为古风灵物或随身器物呈现。背景为竹林、石桥、茶馆或山间雾气，光线柔和，画面有东方电影质感。"],
      ["民国报社主角", "民国报社剧情主角照片", "主体以半身或七分身构图呈现，像站在旧报社、街边书摊或复古办公室中。人物可穿长衫、风衣、旗袍式外套或复古衬衫，不做夸张换脸；非人物主体则呈现旧时代陈列与道具质感。色调为暖棕、暗绿和胶片颗粒，像年代剧剧照。"],
      ["魔法学院来信", "魔法学院来信主题的幻想角色图", "主体以半身或完整主体构图呈现，周围可出现漂浮信封、烛光、书本、星尘和学院长廊元素。人物可穿深色学院风斗篷或制服感服饰；非人物主体则成为魔法伙伴或仪式道具。光线神秘但不阴森，整体精致、奇幻、适合社交分享。"],
      ["赛博街区来客", "赛博街区里的夜行角色照片", "主体位于霓虹街巷或未来商业街中，以半身或七分身构图呈现。人物可穿机能风外套、透明材质配饰或冷色光边缘；非人物主体则保留形态并加入未来材质和电子光效。整体使用蓝紫霓虹、雨后反光地面和浅景深，像游戏角色登录页。"],
      ["荒野赏金猎人", "荒野电影里的赏金猎人角色照", "主体以七分身或完整主体构图呈现，姿态沉稳、有远行感。人物服装可为风衣、围巾、皮革、靴子等荒野元素，不出现真实武器威胁；非人物主体则转化为荒野伙伴或旅行装备。背景为风沙、落日、废旧车站或旷野小镇，整体有西部电影质感。"],
      ["东方玄幻使者", "东方玄幻世界里的使者角色图", "主体以中心构图呈现，周围有云雾、山石、绸带、玉石或柔和光晕。人物服饰可包含古风长袍、纹样、发饰和轻盈布料；非人物主体则保留类别并呈现灵兽、器物或自然精灵感。色彩为青白、墨黑和金色点缀，整体仙气但不过度浮夸。"],
      ["复古侦探档案", "复古侦探档案风角色照片", "主体以近景或半身构图呈现，像站在旧办公室、昏黄街灯或档案室里。人物可穿风衣、西装外套、马甲或简洁帽饰；非人物主体则被呈现为案件线索或复古道具。光线为百叶窗切光、暖色台灯和胶片颗粒，整体悬疑但不恐怖。"],
      ["星际领航员", "星际飞船领航员角色海报", "主体以半身或七分身构图出现在未来舷窗、控制台或星云背景前。人物可穿简洁宇航制服、金属领口和轻量科技装备；非人物主体则作为星际伙伴或核心设备呈现。整体色彩为深蓝、银白和微弱星光，画面清晰、有高级科幻质感。"],
      ["宫廷密信角色", "古典宫廷密信主题角色照", "主体以半身或七分身构图呈现，气质克制、有故事张力。人物可穿古典宫廷服饰、披风或纹理丰富的布料，不做过度艳丽妆造；非人物主体则转化为宫廷器物或信物。背景为屏风、烛光、庭院或深色木质空间，整体像历史剧宣传照。"],
      ["末日城市幸存者", "末日城市幸存者电影角色照", "主体以七分身或完整主体构图呈现，状态坚定但不暴力。人物可穿旧外套、背包、围巾和实用装备；非人物主体则保留形态并融入废墟城市或临时营地。背景为破损城市天际线、阴天光和尘埃层次，整体写实电影感，避免血腥和恐怖元素。"],
      ["海港冒险家", "复古海港冒险家角色照片", "主体以半身、七分身或完整主体构图呈现，像站在码头、船舱或海风街道中。人物可穿风衣、针织、皮革包或航海元素服饰；非人物主体则呈现航海伙伴或旅行器物感。光线为海边日落或阴天柔光，色调复古蓝绿，画面有冒险故事感。"],
      ["蒸汽机械师", "蒸汽朋克机械师角色图", "主体以半身或七分身构图呈现，周围可有齿轮、铜色管线、工作台和雾气。人物可穿皮革围裙、衬衫、护目镜或金属配饰；非人物主体则保留形态并加入机械材质细节。整体色调为铜棕、煤灰和暖光，像高质量游戏概念海报。"],
      ["游戏登录封面", "游戏登录页风格的角色主视觉", "主体位于画面中心，以强识别度姿态呈现，背景有层次但不抢主体。人物可呈现符合角色身份的服装、道具和光效；非人物主体则成为游戏角色、伙伴或核心物件。画面使用清晰边缘、电影级布光和精致场景深度，适合作为社交平台的角色化分享图。"],
      ["雪境守护者", "雪境守护者主题的幻想角色照", "主体以半身或完整主体构图呈现，周围有雪雾、冷光、山脊或冰晶元素。人物可穿厚质披风、毛呢、皮革或冷色服饰；非人物主体则成为雪境伙伴或守护物。整体色彩为冷白、灰蓝和少量暖光，画面安静、强氛围、不恐怖。"],
      ["暗夜玫瑰骑士", "暗夜玫瑰主题的优雅角色海报", "主体以半身或七分身构图呈现，气质克制、优雅、有戏剧张力。人物可穿深色礼服感外套、披风或简洁金属配饰；非人物主体则以玫瑰、暗色布景和高光材质衬托。背景为月光庭院、古堡走廊或暗红花影，画面电影化但不暴露。"],
      ["江湖茶馆侠客", "江湖茶馆里的侠客剧情照", "主体以半身或七分身构图出现在木桌、窗格、茶盏和微尘光线之间。人物服饰以素雅古风、束袖、披肩或长袍为主；非人物主体则作为茶馆中的灵物或器物呈现。光线从窗边斜射，色调暖棕低饱和，像武侠电影里的安静一幕。"],
      ["未来机能角色", "未来机能风角色形象图", "主体以半身或完整主体构图呈现，服装和场景体现轻量科技感。人物可穿机能夹克、多层面料、反光细节和简洁配件；非人物主体则加入未来材料、灯带和模块化结构。背景为地下通道、科技展厅或城市边缘，光线冷静克制，像潮流游戏角色图。"],
      ["童话森林访客", "童话森林访客主题的梦幻角色照", "主体以近景、半身或完整主体构图呈现，周围有蘑菇、微光、树影、花草和轻雾。人物可穿自然材质、斗篷、浅色裙装或宽松外套；非人物主体则成为森林伙伴或魔法物件。整体色彩柔和、清新、梦幻，但保持真实清晰和主体一致。"],
      ["电影反派登场", "电影感强烈的反派登场角色照", "主体以半身或七分身构图呈现，姿态稳定、眼神或轮廓有压迫感但不暴力。人物可穿深色长外套、西装、皮革或极简高领；非人物主体则以暗色布景和强轮廓光呈现。背景为雨夜街道、暗色大厅或城市天台，光线高对比，画面像电影宣传照。"],
    ],
  },
  redbook_vibe: {
    category: "🍓 小红书感",
    manifestPrefix: "redbook_vibe_upload",
    templates: [
      ["周末咖啡封面", "小红书周末咖啡封面感照片", "主体以近景或半身构图呈现，画面有咖啡杯、木桌、窗光、书本或浅色餐盘等生活方式元素。人物可呈现轻松坐姿、自然妆容和日常穿搭；非人物主体则作为咖啡馆主角被干净陈列。整体低饱和、明亮、带轻微胶片颗粒，像高赞生活笔记首图。"],
      ["法式松弛早餐", "法式松弛早餐氛围图", "主体以近景、半身或完整主体构图出现，周围有可颂、咖啡、浅色桌布、鲜花或窗边晨光。人物状态自然不摆拍，服饰清爽；非人物主体则呈现被晨光包裹的生活静物感。色调为奶油白、浅棕和柔和绿，画面适合小红书生活方式分享。"],
      ["窗边自然光", "窗边自然光小红书氛围照片", "主体靠近窗边，以近景或半身构图呈现，背景简洁、有柔和窗帘、绿植或浅色墙面。人物可呈现自然妆发、干净穿搭和松弛表情；非人物主体则保留原有形态并增强光影层次。整体明亮清透、低对比、浅景深，像真实博主随手拍。"],
      ["奶油家居感", "奶油色家居生活方式照片", "主体位于浅色沙发、木地板、白墙、软毯或绿植之间，以舒适构图呈现。人物可穿居家针织、衬衫或干净休闲装；非人物主体则作为家居场景中的核心物件被温柔呈现。整体色彩奶油、低饱和、干净柔和，适合收藏感生活笔记。"],
      ["低饱和探店照", "低饱和探店出片照片", "主体在咖啡馆、买手店、书店、花店或复古小店中，以半身或七分身构图呈现。人物穿搭自然有层次，妆造清爽；非人物主体则作为探店环境中的视觉焦点。背景保留空间氛围但不杂乱，光线柔和，整体像小红书探店博主首图。"],
      ["清透出门 OOTD", "清透出门 OOTD 风格照片", "主体以七分身或完整主体构图呈现，穿搭或主体外观清楚可见，背景为街角、白墙、电梯厅或店门口。人物可呈现日常穿搭、自然发型和干净妆容；非人物主体则被放入穿搭式展示构图中。整体明亮、清爽、有轻微胶片质感，适合发布今日穿搭。"],
      ["花市随拍", "花市随拍感的小红书照片", "主体在花束、绿植、摊位、柔和日光和浅色街景之间，以近景或半身构图呈现。人物状态自然，像边逛边被朋友拍下；非人物主体则与花材形成主次清晰的画面。色彩清新但不过饱和，有生活气息和浅景深，适合社交分享。"],
      ["胶片生活碎片", "胶片生活碎片感照片", "主体以自然、略带抓拍感的构图呈现，可以有轻微运动模糊和真实胶片颗粒，但主体必须清晰可识别。人物穿搭和动作保持日常；非人物主体则像被记录在生活片段中。背景为街角、便利店、车窗、咖啡馆或家居一隅，整体有怀旧温度。"],
      ["日杂封面感", "日杂封面感的清爽照片", "主体以中心或留白构图呈现，画面干净、排版感强但不出现文字。人物可穿浅色衬衫、针织、风衣或自然休闲装；非人物主体则呈现日杂静物美学。背景为白墙、木质空间、街边绿植或窗边，色彩低饱和，像日系生活杂志封面。"],
      ["慵懒午后自拍", "慵懒午后自拍感照片", "主体以近景或半身构图呈现，光线像下午三四点从窗边照进来。人物表情自然、发丝轻松、妆容干净；非人物主体则呈现被午后光线包裹的柔和质感。背景为浅色卧室、沙发、咖啡馆或书桌，整体松弛但精致。"],
      ["治愈浅色系", "治愈浅色系小红书氛围图", "主体以近景、半身或完整主体构图呈现，画面使用白色、米色、浅粉、浅蓝或浅绿等柔和色。人物造型简洁、温柔；非人物主体则增强干净轮廓和柔软氛围。背景可以是家居、花店、公园或窗边，整体清透、舒适、像可收藏的治愈系首图。"],
      ["公园野餐感", "公园野餐感生活照片", "主体位于草地、野餐垫、藤编篮、饮料、书本或自然树影之间，以半身、七分身或完整主体构图呈现。人物状态放松，服饰轻便自然；非人物主体则作为野餐场景主角。光线为午后自然光，色彩清新低饱和，画面有周末感。"],
      ["书店氛围图", "书店或阅读空间的小红书氛围照片", "主体以近景或半身构图出现在书架、木桌、暖色灯光和安静角落中。人物可呈现自然阅读、站在书架旁或轻松回头的状态；非人物主体则成为阅读空间里的核心静物。整体色调暖棕、低饱和、有浅景深，像安静高级的读书笔记配图。"],
      ["海盐蓝夏日", "海盐蓝夏日感照片", "主体以半身、七分身或完整主体构图呈现，背景可为海边、蓝白街道、阳台、泳池边或明亮窗边。人物穿搭清爽但不暴露；非人物主体则保留形态并加入夏日清凉材质和蓝白色调。整体明亮、干净、清爽，适合夏日小红书发布。"],
      ["雨后街角", "雨后街角小红书氛围照片", "主体出现在湿润街道、伞下、玻璃橱窗或雨后咖啡馆门口，以自然抓拍构图呈现。人物造型保持日常、有轻微电影感；非人物主体则和雨滴、反光地面形成氛围。色调低饱和、略冷，画面干净、有故事感。"],
      ["甜酷穿搭封面", "甜酷穿搭封面感照片", "主体以七分身或完整主体构图呈现，穿搭或主体外观有清楚层次和风格冲突。人物可呈现皮革、牛仔、短外套、靴子或金属配饰，但不暴露；非人物主体则通过背景和材质呈现甜酷视觉。背景为街头、白墙、车库或潮流店门口，整体清晰有网感。"],
      ["极简白墙大片", "极简白墙背景的小红书大片", "主体以中心构图或大面积留白构图呈现，背景为白墙、浅灰墙、柔和阴影或极简室内。人物造型干净有线条，妆发自然；非人物主体则以形体、材质和阴影成为画面焦点。整体克制、明亮、有高级排版感，但不要添加任何文字。"],
      ["软糯毛衣季", "软糯毛衣季氛围照片", "主体以近景或半身构图呈现，画面有针织、暖光、木质、杯子或窗边元素。人物可穿毛衣、围巾或柔软外套，妆容温柔自然；非人物主体则呈现温暖柔软的材质关系。色调为奶茶色、浅棕和米白，适合秋冬小红书发布。"],
      ["高赞氛围首图", "小红书高赞氛围首图", "主体以清晰、可点击的主视觉构图呈现，背景干净但有生活细节。人物可呈现自然表情、精致但不夸张的穿搭和妆发；非人物主体则在生活方式场景里成为明确焦点。整体使用低饱和色彩、柔和光线和浅景深，像真实博主封面图。"],
      ["今日好气色", "今日好气色的小红书生活照片", "主体以近景或半身构图呈现，重点是自然精神状态和干净画面。人物可保留真实皮肤质感，只提升光线、气色和画面整洁度；非人物主体则提升颜色明度和清洁度。背景为窗边、浅色家居、咖啡馆或街角，整体自然、轻盈、适合当天发布。"],
    ],
  },
  moments_shot: {
    category: "🌆 朋友圈大片",
    manifestPrefix: "moments_shot_upload",
    templates: [
      ["海边落日刷屏", "海边落日氛围的朋友圈大片", "主体以半身、七分身或完整主体构图呈现，背景为海平线、落日余晖、湿润沙滩或栈道。人物可呈现松弛站姿、回头或侧身状态，服装清爽但不暴露；非人物主体则成为落日海景中的明确焦点。整体金橙色光线、轻微逆光和电影感层次，像旅行相册封面。"],
      ["城市夜景大片", "城市夜景灯光大片", "主体出现在高楼灯光、天桥、街道霓虹或玻璃幕墙前，以半身或七分身构图呈现。人物穿搭简洁、有城市感；非人物主体则保留形态并融入夜景光影。整体使用蓝黑色夜景、暖色灯点和浅景深，画面清晰、有朋友圈刷屏感。"],
      ["雪天氛围感", "雪天氛围朋友圈照片", "主体位于飘雪街道、雪地树林、暖光店铺或白色城市背景中，以近景、半身或完整主体构图呈现。人物可穿大衣、围巾、针织帽或厚外套；非人物主体则保留类别并被雪景温柔包裹。整体冷白、灰蓝和少量暖光，干净浪漫但不失真。"],
      ["旅行明信片", "旅行明信片质感照片", "主体位于有地域感的街道、海岸、山谷、车站或老建筑前，以七分身或完整主体构图呈现。人物动作自然，像旅途中被朋友拍下；非人物主体则作为旅行场景里的主角。整体色彩清晰、构图开阔、有真实景深，像可以直接发朋友圈的旅行成片。"],
      ["天台风很大", "城市天台风感大片", "主体站在天台、露台或高处城市背景前，以半身或七分身构图呈现。人物衣摆、发丝或姿态可以体现风感；非人物主体则通过环境和光线呈现高处氛围。背景为城市天际线、夕阳或阴天灰蓝光，整体自由、有电影海报感。"],
      ["山野自由感", "山野自由感朋友圈大片", "主体位于山路、草坡、森林边缘、湖畔或远山背景中，以完整主体或七分身构图呈现。人物服饰自然户外但不专业摆拍；非人物主体则与自然环境形成清晰主次。光线为清晨、傍晚或阴天柔光，色彩自然低饱和，画面有呼吸感。"],
      ["公路电影照", "公路电影感照片", "主体位于公路、路牌、车窗、旷野或远处天际线之间，以七分身或完整主体构图呈现。人物状态像旅途中停下来被拍，服饰简洁有层次；非人物主体则成为公路故事里的核心元素。整体使用宽幅构图、低饱和色彩和轻微胶片颗粒，像电影截图。"],
      ["落地窗假日", "落地窗假日大片", "主体位于酒店落地窗、城市景观、海景窗边或明亮室内，以近景或半身构图呈现。人物状态放松，服饰舒适但精致；非人物主体则在窗光中呈现假日质感。整体自然光充足、背景干净、有高级度假感，适合朋友圈假日发布。"],
      ["雨夜霓虹漫步", "雨夜霓虹漫步电影照", "主体出现在雨后街道、霓虹招牌、玻璃橱窗或反光路面中，以半身或七分身构图呈现。人物可穿风衣、外套或深色穿搭；非人物主体则与反光地面和灯光形成视觉焦点。整体蓝紫与暖黄光交错，有电影感但不脏乱。"],
      ["秋日银杏路", "秋日银杏路朋友圈照片", "主体位于金黄树叶、街道、长椅或公园路径中，以半身、七分身或完整主体构图呈现。人物可穿风衣、毛衣或大衣，动作自然；非人物主体则保留原有形态并融入秋日环境。整体暖黄、浅棕、低饱和，像真实秋日约拍成片。"],
      ["海岛度假感", "海岛度假感照片", "主体在蓝天、海水、白墙、椰树、泳池边或度假露台前，以七分身或完整主体构图呈现。人物服饰清爽但不暴露，状态自然；非人物主体则保留类别并融入海岛背景。整体明亮清透、蓝白色调、有阳光质感，像高质量旅行照。"],
      ["日落露营照", "日落露营朋友圈大片", "主体位于帐篷、露营椅、草地、山谷、篝火光或日落天空之间，以半身或完整主体构图呈现。人物穿搭自然户外，动作轻松；非人物主体则成为露营场景中的焦点。整体金色夕阳、低饱和绿色和暖光点缀，有周末分享感。"],
      ["城市广角街拍", "城市广角街拍大片", "主体位于建筑立面、人行横道、地铁口、广场或长街透视中，以七分身或完整主体构图呈现。人物穿搭简洁、有城市速度感；非人物主体则通过广角构图强化形体和环境关系。整体线条清晰、空间开阔、像摄影师街拍作品。"],
      ["湖边清晨大片", "湖边清晨自然光大片", "主体位于湖边、栈道、芦苇、晨雾或远山背景中，以半身、七分身或完整主体构图呈现。人物状态安静自然；非人物主体则在湖面反光和晨雾中成为主角。光线柔和、色彩清冷低饱和，整体干净、治愈、适合朋友圈。"],
      ["复古港岛夜色", "复古港岛夜色照片", "主体出现在复古街牌、霓虹、窄街、红绿灯或旧楼外立面前，以半身或七分身构图呈现。人物可穿风衣、衬衫或复古外套；非人物主体则与港风街景融合。整体色调为暖红、墨绿、深蓝和胶片颗粒，像港片剧照。"],
      ["草原风吹过", "草原自由风感大片", "主体在草原、旷野、蓝天、远山或低矮云层下，以完整主体或七分身构图呈现。人物衣摆、发丝或姿态体现自然风感；非人物主体则保持轮廓并融入开阔地景。整体色彩自然、构图宽广、光线柔和，像旅行摄影作品。"],
      ["温泉旅拍感", "温泉旅拍氛围照片", "主体位于雾气、木质空间、山间温泉街、暖灯或石板路之间，以近景或半身构图呈现。人物服饰温暖舒适，不暴露；非人物主体则以温泉旅途场景展示。整体暖色柔光、浅雾和低饱和质感，像冬日旅行朋友圈照片。"],
      ["节日灯火氛围", "节日灯火氛围大片", "主体位于灯串、橱窗、街头装饰、烟火般散景或温暖夜色之间，以近景或半身构图呈现。人物穿搭得体、状态自然；非人物主体则被节日灯光衬托。整体暖光丰富、背景有层次但不混乱，像可以发朋友圈的节日成片。"],
      ["机场出发感", "机场出发感旅行照片", "主体位于机场大厅、行李箱、玻璃幕墙、登机口或城市交通空间中，以半身或七分身构图呈现。人物穿搭舒适利落，像即将出发；非人物主体则作为旅行装备或出发故事主角。整体冷暖平衡、线条干净、有旅行开启感。"],
      ["朋友圈封面照", "适合作为朋友圈封面的高完成度照片", "主体以稳定、清晰、有记忆点的构图呈现，背景可为城市、自然、室内或旅行场景，但必须干净有层次。人物状态自然上镜，非人物主体保留核心形态并突出视觉焦点。整体像真实摄影师拍摄后的社交平台封面图，色彩耐看、光线高级、适合长期展示。"],
    ],
  },
  light_business: {
    category: "👔 轻商务形象",
    manifestPrefix: "light_business_upload",
    templates: [
      ["干净职业头像", "干净自然的轻商务头像", "主体以近景头像或半身构图呈现，背景简洁不空洞。人物可穿衬衫、针织、西装外套或简洁上衣，表情自然可信；非人物主体则以专业展示方式保留形态、材质和关键细节。光线柔和，色调为白、灰、浅蓝或暖米色，适合资料页、头像和职场社交展示，不做证件照效果。"],
      ["会议前好状态", "会议前好状态的职业形象照", "主体以半身或七分身构图呈现，整体精神、清爽、有准备感。人物可呈现简洁职场穿搭、自然妆发和放松表情；非人物主体则以办公桌、会议室或简洁空间衬托。背景为会议室、玻璃墙或浅色办公室，光线自然，画面专业但不僵硬。"],
      ["创始人简介照", "适合创始人或个人简介页的形象照片", "主体以半身或七分身构图呈现，姿态稳定、眼神自然、有可信度。人物服装可以是衬衫、西装外套、针织或深色简洁上衣；非人物主体则以品牌介绍页静物方式呈现。背景为现代办公室、书架、城市窗景或浅灰布景，整体克制、有个人品牌感，但不夸张营销。"],
      ["轻商务半身照", "轻商务半身形象照", "主体以半身构图为主，身体角度自然，背景保留适度空间。人物可穿浅色衬衫、深色外套、针织或简洁商务休闲装，妆发干净；非人物主体则以简洁场景强化专业展示。光线为柔和棚拍或窗边自然光，整体真实、清晰、适合头像和资料页。"],
      ["白衬衫可信感", "白衬衫或浅色衬衫的可信形象照", "主体以近景或半身构图呈现，画面干净、明亮、亲和。人物可穿白衬衫、浅蓝衬衫或简洁上衣，保留真实脸部结构和自然表情；非人物主体则用浅色背景增强干净可信感。背景为浅灰、米白或办公室窗边，整体不油腻、不强销售。"],
      ["办公室自然光", "办公室自然光职业照片", "主体位于办公室、共享办公区、书桌旁或玻璃窗前，以半身或七分身构图呈现。人物穿搭自然职业，姿态像工作间隙被拍；非人物主体则在办公环境中形成清晰主次。整体使用窗边自然光、低饱和色彩和真实空间景深，适合职场社交展示。"],
      ["城市会客形象", "城市会客场景的轻商务形象照", "主体出现在咖啡会客区、酒店大堂、城市窗景或现代建筑前，以半身或七分身构图呈现。人物服饰简洁得体，状态自然；非人物主体则作为会客空间中的核心展示对象。画面有城市质感但不奢张，光线柔和，适合商务社交资料。"],
      ["简历封面形象", "适合简历或作品集封面的自然形象照", "主体以半身或近景构图呈现，背景简洁、有留白但不添加文字。人物形象清爽、可信、不过度修饰；非人物主体则作为作品集封面式主视觉呈现。色彩克制，光线柔和，整体专业、友好、有真实摄影质感，不生成证件照或资质证明感。"],
      ["讲者海报感", "讲者介绍页风格的形象照片", "主体以半身或七分身构图呈现，姿态稳定，有分享者、讲述者的气质。人物可穿深色外套、衬衫或简洁针织，背景可为讲台、幕布、书架或现代空间；非人物主体则以展示台或主视觉方式呈现。画面像活动介绍页照片，但不要出现任何文字和 logo。"],
      ["团队主页照片", "适合团队主页使用的自然职业照片", "主体以半身构图呈现，背景统一、干净、有团队页的视觉秩序。人物表情自然亲和，服装简洁职业但不僵硬；非人物主体则以官网主图风格展示。光线均匀，色调为浅灰、白、米色或低饱和蓝，整体专业可信。"],
      ["温和专业感", "温和专业的个人形象照", "主体以近景或半身构图呈现，氛围亲和、稳定、不过度强势。人物可穿柔和色衬衫、针织或西装外套，妆发自然；非人物主体则在简洁环境中突出可靠质感。背景为窗边、书架、办公桌或浅色布景，光线柔和，适合客户沟通头像。"],
      ["咨询顾问形象", "咨询顾问式轻商务形象照", "主体以半身或七分身构图呈现，状态冷静、清楚、有条理。人物可穿衬衫、西装外套或商务休闲服装，不做夸张精英范；非人物主体则与笔记本、文件夹或会议桌环境形成专业关系。整体色彩克制、构图干净，适合资料页使用。"],
      ["自由职业档案", "自由职业者档案页形象照片", "主体以半身、近景或七分身构图呈现，气质专业但松弛。人物可穿休闲西装、衬衫、针织或干净 T 恤，背景为咖啡馆、共享办公、书桌或窗边；非人物主体则呈现个人工作空间中的核心物件。整体自然、真实、有个人品牌感。"],
      ["低调精英感", "低调克制的高级职业形象照", "主体以半身或七分身构图呈现，姿态稳重但不端着。人物服装以黑白灰、藏蓝、深棕或低饱和色为主，妆发干净自然；非人物主体则通过深色背景和柔光呈现高级材质。整体低调、有质感，不夸张炫富、不强销售。"],
      ["干练通勤照", "干练通勤风职业照片", "主体以半身或七分身构图呈现，像工作日通勤中被自然拍下。人物可穿衬衫、外套、风衣、通勤包或简洁配饰；非人物主体则融入城市通勤空间。背景为写字楼、街角、地铁入口或玻璃幕墙，光线自然，画面清爽利落。"],
      ["个人品牌主图", "适合个人品牌主页的主图照片", "主体以有留白的半身或七分身构图呈现，背景可用于页面设计但不生成文字。人物形象真实、清楚、有可信感；非人物主体则以主视觉方式展示其形体和材质。光线专业、色彩统一，整体适合小程序、公众号或社交资料主页。"],
      ["咖啡会谈照", "咖啡会谈场景的轻商务照片", "主体位于咖啡馆、会谈桌、窗边座位或浅色公共空间中，以半身或近景构图呈现。人物状态自然，像在轻松商务沟通中；非人物主体则作为会谈空间的视觉焦点。背景有杯子、桌面或柔和灯光，但保持整洁，整体专业中带亲和。"],
      ["灰调背景头像", "灰调背景的高级职业头像", "主体以近景头像或半身构图呈现，背景为浅灰、深灰或柔和渐变灰，不添加文字。人物可穿衬衫、西装外套或简洁深色上衣，表情自然可信；非人物主体则在灰调背景上保留清晰轮廓和材质。整体光线均匀、有层次，适合长期头像。"],
      ["职场社交封面", "职场社交平台封面形象照片", "主体以半身或七分身构图呈现，画面有适当环境留白，适合资料页顶部或封面。人物形象自然职业，不做证件照、不做强销售姿势；非人物主体则以清晰主视觉方式呈现。背景为办公室、城市窗景、书架或浅色空间，整体稳重、友好、有发布价值。"],
      ["可信介绍页照", "适合介绍页的可信形象照", "主体以半身或近景构图呈现，重点是真实、清晰、可信和易沟通。人物可穿简洁商务休闲服饰，表情自然；非人物主体则通过简洁场景和柔和光线强化可信展示。背景保持干净、有少量空间层次，整体像真实摄影师拍摄的介绍页配图，不生成任何文字、logo 或证明类元素。"],
    ],
  },
};

function buildPrompt([, result, details]) {
  return `将这张图片转换为：${result}。${IDENTITY_RULE}${details}${NEGATIVE_RULE}`;
}

function parseArgs() {
  const args = new Map();
  for (const rawArg of process.argv.slice(2)) {
    const [key, value = "true"] = rawArg.replace(/^--/, "").split("=");
    args.set(key, value);
  }
  return args;
}

async function readApiKey() {
  const text = await fs.readFile(envPath, "utf8");
  const match = text.match(/^TEMPLATE_INGEST_API_KEY=(.*)$/m);
  if (!match) {
    throw new Error("TEMPLATE_INGEST_API_KEY is missing in Backend/.env");
  }
  return match[1].trim().replace(/^["']|["']$/g, "");
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  throw new Error(`Unsupported image extension: ${filePath}`);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = null;
  if (text.trim()) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text.slice(0, 300) };
    }
  }
  if (!response.ok || payload?.success === false) {
    const message = payload?.message ?? payload?.error ?? payload?.raw ?? response.statusText;
    throw new Error(`${options.method ?? "GET"} ${url} failed (${response.status}): ${message}`);
  }
  return payload;
}

async function putFile(uploadUrl, filePath, contentType) {
  const body = await fs.readFile(filePath);
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });
  if (![200, 201, 204].includes(response.status)) {
    throw new Error(`PUT cover failed (${response.status}): ${response.statusText}`);
  }
}

async function listImages() {
  const entries = await fs.readdir(imageDir, { withFileTypes: true });
  const images = entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(imageDir, entry.name))
    .filter((filePath) => [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(path.extname(filePath).toLowerCase()))
    .sort((left, right) => left.localeCompare(right));
  if (images.length < 20) {
    throw new Error(`Need at least 20 local cover images, found ${images.length}`);
  }
  return shuffle(images);
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function externalId(slug, index, name) {
  const digest = createHash("sha1").update(`${slug}:${index}:${name}`).digest("hex").slice(0, 10);
  return `jibian_prompt_v1_${slug}_${String(index + 1).padStart(2, "0")}_${digest}`;
}

function timestampForFile(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "_",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

function timestampIsoLocal(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absOffset = Math.abs(offsetMinutes);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${pad(Math.floor(absOffset / 60))}${pad(absOffset % 60)}`;
}

function publishedTemplatesFrom(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  return [];
}

async function loadPublishedTemplates() {
  const payload = await requestJson(`${API_BASE}/api/templates`);
  return publishedTemplatesFrom(payload);
}

function findExisting(publishedTemplates, category, name) {
  return publishedTemplates.find((template) => template.category === category && template.name === name && template.status === "published");
}

async function uploadPack(slug, apiKey) {
  const pack = packs[slug];
  if (!pack) {
    throw new Error(`Unknown category slug: ${slug}`);
  }

  const authHeaders = { "X-Template-Ingest-Key": apiKey };
  const categories = await requestJson(`${API_BASE}/api/v1/template-ingest/categories`, {
    headers: authHeaders,
  });
  const categoryNames = new Set(categories?.data?.items?.map((item) => item.name) ?? []);
  if (!categoryNames.has(pack.category)) {
    throw new Error(`Cloud category does not exist: ${pack.category}`);
  }

  await fs.mkdir(manifestDir, { recursive: true });
  const images = await listImages();
  let publishedTemplates = await loadPublishedTemplates();
  const results = [];
  const failures = [];

  console.log(`开始上传：${pack.category}`);

  for (const [index, template] of pack.templates.entries()) {
    const [name] = template;
    const prompt = buildPrompt(template);
    const existing = findExisting(publishedTemplates, pack.category, name);
    if (existing) {
      console.log(`跳过已存在 ${index + 1}/20：${name}`);
      results.push({
        index: index + 1,
        template_id: existing.id,
        name,
        category: pack.category,
        status: "published",
        action: "skipped_existing",
        cover_asset_id: existing.cover_asset_id,
        price_credits: PRICE_CREDITS,
        result_count: RESULT_COUNT,
        external_id: externalId(slug, index, name),
      });
      continue;
    }

    const sourceImage = images[index % images.length];
    const contentType = contentTypeFor(sourceImage);

    try {
      const upload = await requestJson(`${API_BASE}/api/v1/template-ingest/covers/upload-url`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ content_type: contentType }),
      });
      await putFile(upload.data.upload_url, sourceImage, contentType);

      const created = await requestJson(`${API_BASE}/api/v1/template-ingest/templates`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category: pack.category,
          cover_asset_id: upload.data.asset_id,
          prompt,
          price_credits: PRICE_CREDITS,
          result_count: RESULT_COUNT,
          external_id: externalId(slug, index, name),
        }),
      });

      console.log(`已上传 ${index + 1}/20：${name}`);
      results.push({
        index: index + 1,
        template_id: created.data.id,
        name: created.data.name,
        category: created.data.category,
        status: created.data.status,
        sort_order: created.data.sort_order,
        cover_asset_id: created.data.cover_asset_id,
        source_image: sourceImage,
        content_type: contentType,
        price_credits: created.data.price_credits,
        result_count: created.data.result_count,
        external_id: externalId(slug, index, name),
      });
      publishedTemplates = [...publishedTemplates, {
        id: created.data.id,
        name: created.data.name,
        category: created.data.category,
        status: created.data.status,
        cover_asset_id: created.data.cover_asset_id,
      }];
    } catch (error) {
      console.error(`失败 ${index + 1}/20：${name} - ${error.message}`);
      failures.push({
        index: index + 1,
        name,
        category: pack.category,
        source_image: sourceImage,
        content_type: contentType,
        error: error.message,
        external_id: externalId(slug, index, name),
      });
    }
  }

  const verifyTemplates = await loadPublishedTemplates();
  const verified = results.map((result) => {
    const visible = verifyTemplates.some((template) => template.category === pack.category && template.name === result.name && template.status === "published");
    return { name: result.name, visible, status: visible ? "published" : "missing" };
  });

  const uploadedAt = timestampIsoLocal();
  const manifest = {
    uploaded_at: uploadedAt,
    api_base: API_BASE,
    category: pack.category,
    price_credits: PRICE_CREDITS,
    result_count: RESULT_COUNT,
    count: results.length,
    created_count: results.filter((result) => result.action !== "skipped_existing").length,
    skipped_existing_count: results.filter((result) => result.action === "skipped_existing").length,
    failure_count: failures.length,
    verified_count: verified.filter((item) => item.visible).length,
    results,
    failures,
    verification: verified,
  };

  const manifestPath = path.join(manifestDir, `${pack.manifestPrefix}_${timestampForFile()}.json`);
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(`完成：${pack.category} created=${manifest.created_count} skipped=${manifest.skipped_existing_count} failures=${failures.length} verified=${manifest.verified_count}/20`);
  console.log(`manifest: ${manifestPath}`);

  return { slug, manifestPath, ...manifest };
}

async function main() {
  const args = parseArgs();
  const selectedSlug = args.get("category");
  const slugs = selectedSlug ? [selectedSlug] : Object.keys(packs);
  const apiKey = await readApiKey();
  const summaries = [];

  for (const slug of slugs) {
    summaries.push(await uploadPack(slug, apiKey));
  }

  const failed = summaries.some((summary) => summary.failure_count > 0 || summary.verified_count !== summary.count);
  if (failed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
