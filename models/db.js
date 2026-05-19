const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { query, run, get, isPostgres } = require('../config/database');

const CLASS_PROMOTION_ORDER = {
  'JSS1': 'JSS2', 'JSS2': 'JSS3', 'JSS3': 'SS1',
  'SS1': 'SS2', 'SS2': 'SS3', 'SS3': null,
};

const WORDS = [
  'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract', 'abuse', 'accept',
  'access', 'accuse', 'achieve', 'acid', 'acoustic', 'acquire', 'across', 'act', 'action', 'actor',
  'actress', 'actual', 'adapt', 'add', 'adjust', 'admit', 'adopt', 'adult', 'advance', 'advice',
  'affair', 'affect', 'afford', 'afraid', 'after', 'again', 'age', 'agent', 'agree', 'ahead',
  'aid', 'aim', 'air', 'airport', 'alarm', 'album', 'alert', 'alien', 'align', 'alive',
  'all', 'allow', 'almost', 'alone', 'along', 'already', 'also', 'alter', 'always', 'amaze',
  'among', 'amount', 'ample', 'amuse', 'anchor', 'angel', 'anger', 'angle', 'animal', 'ankle',
  'annual', 'another', 'answer', 'anti', 'anxiety', 'any', 'apart', 'apology', 'appear', 'apple',
  'apply', 'april', 'area', 'argue', 'arm', 'army', 'around', 'arrange', 'arrest', 'arrive',
  'arrow', 'art', 'artist', 'aside', 'ask', 'aspect', 'assault', 'asset', 'assist', 'assume',
  'asthma', 'atom', 'attack', 'attend', 'attitude', 'attract', 'auction', 'audio', 'audit', 'august',
  'aunt', 'author', 'auto', 'autumn', 'average', 'avocado', 'avoid', 'awake', 'award', 'aware',
  'awful', 'baby', 'back', 'bad', 'bag', 'balance', 'ball', 'banana', 'band', 'bank',
  'bar', 'barely', 'barrel', 'base', 'basic', 'basin', 'basis', 'basket', 'battle', 'beach',
  'bean', 'bear', 'beat', 'beauty', 'become', 'bed', 'beef', 'before', 'begin', 'behave',
  'behind', 'believe', 'bell', 'belong', 'below', 'belt', 'bench', 'bend', 'benefit', 'best',
  'betray', 'better', 'between', 'beyond', 'bicycle', 'bid', 'big', 'bike', 'bind', 'biology',
  'bird', 'birth', 'bitter', 'black', 'blade', 'blame', 'blanket', 'blast', 'bleak', 'bless',
  'blind', 'blood', 'blossom', 'blouse', 'blue', 'blur', 'board', 'boat', 'body', 'boil',
  'bomb', 'bone', 'bonus', 'book', 'boost', 'border', 'boring', 'borrow', 'boss', 'bottle',
  'bottom', 'bounce', 'box', 'boy', 'bracket', 'brain', 'brand', 'brass', 'brave', 'bread',
  'breeze', 'brick', 'bridge', 'brief', 'bright', 'bring', 'brisk', 'broad', 'brochure', 'broken',
  'bronze', 'broom', 'brother', 'brown', 'brush', 'bubble', 'buddy', 'budget', 'buffalo', 'build',
  'bulb', 'bulk', 'bullet', 'bundle', 'burden', 'burger', 'burst', 'bus', 'business', 'busy',
  'butter', 'button', 'buy', 'cabin', 'cable', 'cactus', 'cage', 'cake', 'call', 'calm',
  'camera', 'camp', 'can', 'canal', 'cancel', 'candle', 'canoe', 'canvas', 'canyon', 'capable',
  'capital', 'captain', 'car', 'carbon', 'card', 'cargo', 'carpet', 'carry', 'cart', 'case',
  'cash', 'casino', 'castle', 'casual', 'cat', 'catalog', 'catch', 'category', 'cattle', 'caught',
  'cause', 'caution', 'cave', 'cease', 'celebrate', 'cell', 'cement', 'census', 'center', 'cereal',
  'certain', 'chain', 'chair', 'chalk', 'champion', 'change', 'chaos', 'chapter', 'charge', 'chase',
  'chat', 'cheap', 'check', 'cheese', 'chef', 'cherry', 'chess', 'chest', 'chicken', 'chief',
  'child', 'chimney', 'choice', 'choose', 'chronic', 'chunk', 'cigar', 'circle', 'citizen', 'city',
  'civil', 'claim', 'clap', 'clarify', 'claw', 'clay', 'clean', 'clerk', 'clever', 'click',
  'client', 'cliff', 'climb', 'clinic', 'clip', 'clock', 'close', 'cloth', 'cloud', 'clown',
  'club', 'clump', 'cluster', 'coach', 'coal', 'coast', 'coconut', 'code', 'coffee', 'coil',
  'coin', 'collect', 'color', 'column', 'combine', 'come', 'comfort', 'comic', 'common', 'company',
  'concert', 'conduct', 'confirm', 'congress', 'connect', 'consider', 'control', 'convince', 'cook', 'cool',
  'copper', 'copy', 'coral', 'core', 'corner', 'correct', 'cost', 'cotton', 'couch', 'country',
  'couple', 'course', 'cousin', 'cover', 'coyote', 'crack', 'cradle', 'craft', 'crane', 'crash',
  'crate', 'crawl', 'crazy', 'cream', 'credit', 'creek', 'crew', 'cricket', 'crime', 'crisp',
  'critic', 'crop', 'cross', 'crowd', 'crystal', 'cube', 'culture', 'cup', 'curious', 'current',
  'curtain', 'curve', 'cushion', 'custom', 'cute', 'cycle', 'dad', 'damage', 'damp', 'dance',
  'danger', 'dare', 'dark', 'darling', 'dash', 'data', 'date', 'daughter', 'dawn', 'day',
  'dead', 'deal', 'dear', 'death', 'debate', 'debt', 'decade', 'december', 'decide', 'declare',
  'decline', 'decoy', 'decrease', 'deep', 'deer', 'defeat', 'defend', 'define', 'degree', 'delay',
  'deliver', 'demand', 'denial', 'depart', 'depend', 'deposit', 'depress', 'depth', 'deputy', 'derive',
  'describe', 'desert', 'design', 'desk', 'detect', 'develop', 'device', 'devote', 'dialog', 'diamond',
  'diary', 'dice', 'diet', 'differ', 'digital', 'dignity', 'dilemma', 'dinner', 'dioxide', 'direct',
  'dirty', 'disable', 'disco', 'dish', 'dismiss', 'display', 'distant', 'dive', 'divide', 'divorce',
  'dizzy', 'doctor', 'document', 'dog', 'doll', 'dolphin', 'domain', 'donate', 'donkey', 'donor',
  'door', 'dose', 'double', 'doubt', 'dove', 'down', 'dozen', 'draft', 'dragon', 'drama',
  'draw', 'dream', 'dress', 'drift', 'drill', 'drink', 'drive', 'drop', 'drum', 'dry',
  'duck', 'dumb', 'dune', 'during', 'dust', 'dutch', 'duty', 'dwarf', 'dynamic', 'eager',
  'eagle', 'early', 'earn', 'earth', 'easily', 'east', 'easy', 'echo', 'ecology', 'economy',
  'edge', 'editor', 'educate', 'effect', 'effort', 'egg', 'eight', 'either', 'elbow', 'elder',
  'electric', 'elegant', 'element', 'elephant', 'elevate', 'elite', 'else', 'embrace', 'emerge', 'emotion',
  'emperor', 'employ', 'empty', 'enable', 'end', 'enemy', 'energy', 'enforce', 'engage', 'engine',
  'enhance', 'enjoy', 'enormous', 'enough', 'enroll', 'ensure', 'enter', 'entire', 'entry', 'envelope',
  'episode', 'equal', 'equip', 'era', 'erase', 'erode', 'error', 'erupt', 'escape', 'essay',
  'estate', 'eternal', 'ethics', 'evaluate', 'even', 'event', 'ever', 'every', 'evict', 'evidence',
  'evil', 'evoke', 'exact', 'exam', 'exceed', 'excel', 'except', 'excess', 'exchange', 'excite',
  'excuse', 'execute', 'exercise', 'exhaust', 'exhibit', 'exile', 'exist', 'exit', 'expand', 'expect',
  'expire', 'explain', 'expose', 'extend', 'extra', 'exult', 'eye', 'eyebrow', 'fabric', 'face',
  'fade', 'fail', 'faint', 'fair', 'faith', 'fall', 'family', 'famous', 'fan', 'fancy',
  'fantasy', 'farm', 'fashion', 'fat', 'father', 'fault', 'favor', 'feast', 'feather', 'feature',
  'february', 'federal', 'fee', 'feed', 'feel', 'female', 'fence', 'festival', 'fetch', 'fever',
  'few', 'fiber', 'fiction', 'field', 'figure', 'file', 'film', 'filter', 'final', 'find',
  'fine', 'finger', 'finish', 'fire', 'firm', 'first', 'fiscal', 'fish', 'fit', 'fitness',
  'fix', 'flag', 'flame', 'flash', 'flat', 'flavor', 'flee', 'fleet', 'flesh', 'flex',
  'flick', 'flight', 'flip', 'float', 'flock', 'flood', 'floor', 'flour', 'flow', 'flower',
  'fluid', 'flush', 'fly', 'foam', 'focus', 'fog', 'fold', 'folk', 'follow', 'food',
  'foot', 'force', 'forever', 'fork', 'form', 'fortune', 'forum', 'forward', 'fossil', 'found',
  'fox', 'fragile', 'frame', 'free', 'freeze', 'french', 'frequent', 'fresh', 'friend', 'fringe',
  'frog', 'front', 'frost', 'frown', 'frozen', 'fruit', 'fuel', 'fun', 'funny', 'furnace',
  'future', 'gadget', 'gain', 'galaxy', 'gallery', 'game', 'gap', 'garage', 'garbage', 'garden',
  'garlic', 'garment', 'gas', 'gasp', 'gate', 'gather', 'gauge', 'gaze', 'gear', 'gender',
  'gene', 'general', 'genius', 'genre', 'gentle', 'genuine', 'gesture', 'ghost', 'giant', 'gift',
  'giggle', 'ginger', 'giraffe', 'girl', 'give', 'glad', 'glance', 'glass', 'glide', 'glimpse',
  'globe', 'gloom', 'glory', 'glove', 'glow', 'glue', 'goat', 'golden', 'golf', 'good',
  'goose', 'gorilla', 'gospel', 'gossip', 'govern', 'gown', 'grab', 'grace', 'grain', 'grant',
  'grape', 'grass', 'gravity', 'great', 'green', 'greet', 'grid', 'grief', 'grill', 'grin',
  'grip', 'grocery', 'group', 'grow', 'guarantee', 'guard', 'guess', 'guest', 'guide', 'guilt',
  'guitar', 'gun', 'gym', 'habit', 'hair', 'half', 'hammer', 'hamster', 'hand', 'happy',
  'harbor', 'hard', 'harsh', 'harvest', 'hat', 'hate', 'haunt', 'haven', 'hawk', 'head',
  'health', 'heart', 'heavy', 'hedge', 'height', 'hello', 'helmet', 'help', 'hen', 'herb',
  'herd', 'here', 'hero', 'hidden', 'high', 'hill', 'hint', 'hip', 'hire', 'history',
  'hobby', 'hockey', 'hold', 'hole', 'holiday', 'hollow', 'home', 'honey', 'hood', 'hope',
  'horn', 'horror', 'horse', 'hospital', 'host', 'hotel', 'hour', 'hover', 'hub', 'huge',
  'human', 'humble', 'humor', 'hundred', 'hungry', 'hunt', 'hurdle', 'hurry', 'hurt', 'husband',
  'hybrid', 'ice', 'icon', 'idea', 'identify', 'ignore', 'image', 'imagine', 'impact', 'impose',
  'improve', 'impulse', 'inch', 'include', 'income', 'increase', 'index', 'indicate', 'indoor', 'industry',
  'infant', 'inflict', 'inform', 'inhabit', 'inherit', 'initial', 'inject', 'injure', 'inmate', 'inner',
  'input', 'inquiry', 'insect', 'inside', 'insist', 'install', 'intact', 'intake', 'intend', 'interact',
  'interest', 'intern', 'interview', 'into', 'invade', 'invent', 'invest', 'invite', 'iron', 'island',
  'isolate', 'issue', 'item', 'ivory', 'jacket', 'jaguar', 'jail', 'jam', 'jar', 'jazz',
  'jealous', 'jeans', 'jelly', 'jewel', 'job', 'join', 'joke', 'journal', 'journey', 'joy',
  'judge', 'juice', 'jump', 'jungle', 'junior', 'junk', 'jury', 'just', 'justice', 'kangaroo',
  'keen', 'keep', 'ketchup', 'key', 'kick', 'kid', 'kidney', 'kind', 'kingdom', 'kiss',
  'kit', 'kitchen', 'kite', 'kitten', 'kiwi', 'knee', 'knife', 'knock', 'know', 'koala',
  'label', 'labor', 'lace', 'lack', 'ladder', 'lady', 'lake', 'lamp', 'land', 'language',
  'laptop', 'large', 'laser', 'last', 'late', 'laundry', 'lava', 'law', 'lawn', 'lawsuit',
  'layer', 'lazy', 'leader', 'leaf', 'learn', 'least', 'leather', 'leave', 'lecture', 'left',
  'leg', 'legal', 'legend', 'lemon', 'lend', 'length', 'lens', 'leopard', 'lesson', 'letter',
  'level', 'liar', 'liberty', 'library', 'license', 'life', 'lift', 'light', 'like', 'limit',
  'line', 'link', 'lion', 'liquid', 'list', 'little', 'live', 'lizard', 'load', 'loan',
  'lobster', 'local', 'lock', 'logic', 'lonely', 'long', 'loop', 'lottery', 'loud', 'lounge',
  'love', 'loyal', 'lucky', 'luggage', 'lumber', 'lunar', 'lunch', 'lung', 'luxury', 'lyrics',
  'machine', 'mad', 'magazine', 'magic', 'magnet', 'maid', 'mail', 'main', 'major', 'make',
  'mammal', 'man', 'manage', 'mandate', 'mango', 'mansion', 'manual', 'maple', 'marble', 'march',
  'margin', 'marine', 'market', 'marriage', 'mask', 'mass', 'master', 'match', 'material', 'matrix',
  'matter', 'mayor', 'meadow', 'meal', 'measure', 'meat', 'mechanic', 'medal', 'media', 'melody',
  'melt', 'member', 'memory', 'mention', 'menu', 'mercy', 'merge', 'merit', 'merry', 'mesh',
  'message', 'metal', 'method', 'middle', 'midnight', 'milk', 'million', 'mimic', 'mind', 'mineral',
  'minimum', 'minor', 'minute', 'miracle', 'mirror', 'misery', 'miss', 'mistake', 'mix', 'mixture',
  'mobile', 'model', 'modify', 'mom', 'moment', 'monitor', 'monkey', 'monster', 'month', 'moon',
  'moral', 'more', 'morning', 'mosquito', 'mother', 'motion', 'motor', 'mountain', 'mouse', 'move',
  'movie', 'much', 'mule', 'multiply', 'muscle', 'museum', 'music', 'must', 'mutual', 'mystery',
  'myth', 'naive', 'name', 'napkin', 'narrow', 'nasty', 'nation', 'nature', 'near', 'neck',
  'need', 'negative', 'neglect', 'neither', 'nephew', 'nerve', 'nest', 'net', 'network', 'neutral',
  'never', 'news', 'next', 'nice', 'night', 'noble', 'noise', 'nominee', 'noodle', 'normal',
  'north', 'nose', 'notable', 'note', 'nothing', 'notice', 'novel', 'now', 'nuclear', 'number',
  'nurse', 'nut', 'oak', 'obey', 'object', 'oblige', 'obscure', 'observe', 'obtain', 'obvious',
  'occur', 'ocean', 'october', 'odor', 'off', 'offend', 'offer', 'office', 'oil', 'old',
  'olive', 'omega', 'onion', 'online', 'open', 'opera', 'opinion', 'option', 'orange', 'orbit',
  'orchard', 'order', 'organ', 'orient', 'origin', 'ornate', 'other', 'otter', 'ought', 'ounce',
  'outcome', 'output', 'outset', 'outside', 'oval', 'oven', 'over', 'owner', 'oxide', 'oxygen',
  'oyster', 'ozone', 'pace', 'pack', 'paddle', 'page', 'paid', 'pain', 'paint', 'pair',
  'palace', 'palm', 'panda', 'panel', 'panic', 'panther', 'paper', 'parade', 'parent', 'parish',
  'park', 'parrot', 'party', 'pass', 'patch', 'path', 'patient', 'patrol', 'pattern', 'pause',
  'pave', 'payment', 'peace', 'peanut', 'pear', 'peasant', 'pelican', 'penalty', 'pencil', 'people',
  'pepper', 'perfect', 'permit', 'person', 'pet', 'phone', 'photo', 'phrase', 'physical', 'piano',
  'picnic', 'picture', 'piece', 'pig', 'pigeon', 'pill', 'pilot', 'pink', 'pioneer', 'pipe',
  'pistol', 'pitch', 'pizza', 'place', 'planet', 'plastic', 'plate', 'play', 'player', 'pleasure',
  'plenty', 'plot', 'pluck', 'plug', 'plunge', 'poem', 'poet', 'point', 'polar', 'police',
  'pond', 'pony', 'pool', 'popular', 'portion', 'position', 'possible', 'post', 'potato', 'pottery',
  'poverty', 'powder', 'power', 'practice', 'praise', 'predict', 'prefer', 'pregnant', 'premium', 'prepare',
  'present', 'prevent', 'price', 'pride', 'primary', 'print', 'priority', 'prison', 'privacy', 'private',
  'prize', 'problem', 'process', 'produce', 'profit', 'program', 'project', 'promote', 'proof', 'property',
  'protect', 'protein', 'protest', 'proud', 'prove', 'provide', 'public', 'pudding', 'pull', 'pulse',
  'pump', 'punch', 'punish', 'pupil', 'puppet', 'purchase', 'purple', 'purpose', 'purse', 'push',
  'put', 'puzzle', 'pyramid', 'quality', 'quantum', 'quarter', 'queen', 'query', 'quest', 'question',
  'queue', 'quick', 'quiet', 'quilt', 'quit', 'quote', 'rabbit', 'raccoon', 'race', 'rack',
  'radar', 'radio', 'rail', 'rain', 'raise', 'rally', 'ramp', 'ranch', 'random', 'range',
  'rapid', 'rare', 'rate', 'rather', 'raven', 'raw', 'razor', 'ready', 'real', 'reason',
  'rebel', 'rebuild', 'recall', 'receive', 'recipe', 'record', 'recycle', 'reduce', 'reflect', 'reform',
  'refuse', 'region', 'regret', 'reject', 'relax', 'relay', 'release', 'relief', 'rely', 'remain',
  'remark', 'remedy', 'remind', 'remote', 'remove', 'render', 'rental', 'repair', 'repeat', 'replace',
  'report', 'request', 'rescue', 'resist', 'resolve', 'resort', 'result', 'retail', 'retire', 'retreat',
  'return', 'reveal', 'review', 'reward', 'rhythm', 'rib', 'ribbon', 'rice', 'rich', 'ride',
  'ridge', 'rifle', 'right', 'rigid', 'ring', 'riot', 'ripple', 'risk', 'rival', 'river',
  'road', 'roast', 'robot', 'robust', 'rocket', 'rod', 'romance', 'roof', 'room', 'root',
  'rope', 'rose', 'rotate', 'rough', 'round', 'route', 'rover', 'row', 'royal', 'rubber',
  'rugby', 'ruin', 'rule', 'run', 'rural', 'rust', 'saber', 'sack', 'sacred', 'sad',
  'saddle', 'safari', 'safe', 'sail', 'salad', 'salary', 'salmon', 'salt', 'salute', 'same',
  'sample', 'sand', 'satellite', 'satisfy', 'sauce', 'save', 'scale', 'scan', 'scene', 'scheme',
  'school', 'science', 'scissors', 'scorpion', 'screen', 'script', 'scroll', 'seal', 'search', 'season',
  'seat', 'second', 'secret', 'section', 'security', 'seed', 'segment', 'select', 'self', 'seminar',
  'senior', 'sense', 'sentence', 'series', 'service', 'session', 'settle', 'setup', 'seven', 'shadow',
  'shaft', 'shallow', 'shame', 'shape', 'share', 'shark', 'sharp', 'shave', 'shed', 'sheet',
  'shelf', 'shell', 'sheriff', 'shield', 'shift', 'shine', 'ship', 'shirt', 'shock', 'shoe',
  'shoot', 'shop', 'shore', 'short', 'shot', 'should', 'shove', 'shrimp', 'shrug', 'shuffle',
  'shy', 'sibling', 'sick', 'side', 'siege', 'sight', 'sign', 'signal', 'silence', 'silk',
  'silly', 'silver', 'similar', 'simple', 'since', 'sing', 'siren', 'sister', 'situate', 'six',
  'size', 'skate', 'sketch', 'ski', 'skill', 'skin', 'skip', 'skirt', 'skull', 'slab',
  'slave', 'sleep', 'slice', 'slide', 'slight', 'slip', 'slope', 'slot', 'small', 'smart',
  'smell', 'smile', 'smoke', 'smooth', 'snack', 'snake', 'snap', 'sniff', 'snow', 'soap',
  'soccer', 'social', 'sock', 'soda', 'soft', 'solar', 'soldier', 'solid', 'solution', 'solve',
  'someone', 'song', 'soon', 'sorry', 'sort', 'soul', 'sound', 'soup', 'source', 'south',
  'space', 'spare', 'spatial', 'speak', 'special', 'speed', 'spell', 'spend', 'sphere', 'spice',
  'spider', 'spike', 'spin', 'spirit', 'split', 'spoil', 'sponsor', 'spoon', 'sport', 'spot',
  'spray', 'spread', 'spring', 'spy', 'square', 'squeeze', 'squirrel', 'stable', 'stadium', 'staff',
  'stage', 'stair', 'stamp', 'stand', 'start', 'state', 'static', 'statue', 'stay', 'steak',
  'steal', 'steam', 'steel', 'steep', 'steer', 'stem', 'step', 'stick', 'stiff', 'still',
  'sting', 'stock', 'stomach', 'stone', 'stool', 'stop', 'store', 'storm', 'story', 'stove',
  'strange', 'strategy', 'straw', 'stream', 'street', 'strength', 'stress', 'stretch', 'strict', 'strike',
  'string', 'strip', 'stroke', 'strong', 'structure', 'studio', 'study', 'stuff', 'style', 'subject',
  'submit', 'subtle', 'suburb', 'succeed', 'such', 'sudden', 'suffer', 'sugar', 'suggest', 'suit',
  'summer', 'summit', 'sun', 'sunny', 'super', 'supply', 'support', 'sure', 'surface', 'surgery',
  'surplus', 'surround', 'survey', 'survive', 'suspect', 'sustain', 'swallow', 'swamp', 'swan', 'swap',
  'swear', 'sweep', 'sweet', 'swell', 'swift', 'swim', 'swing', 'switch', 'sword', 'symbol',
  'system', 'table', 'tablet', 'tackle', 'tactic', 'tail', 'take', 'tale', 'talent', 'talk',
  'tank', 'tape', 'target', 'task', 'taste', 'tattoo', 'taxi', 'teach', 'team', 'tear',
  'temple', 'tenant', 'tennis', 'tension', 'term', 'terrace', 'test', 'text', 'thank', 'theme',
  'theory', 'therapy', 'thick', 'thief', 'thing', 'think', 'third', 'thorn', 'thought', 'thread',
  'threat', 'thrill', 'thrive', 'throat', 'throne', 'through', 'throw', 'thumb', 'thunder', 'ticket',
  'tide', 'tiger', 'tilt', 'timber', 'time', 'tiny', 'tip', 'tired', 'tissue', 'title',
  'toast', 'tobacco', 'today', 'toddler', 'toe', 'together', 'toilet', 'token', 'tomato', 'tomorrow',
  'tone', 'tongue', 'tonight', 'tool', 'tooth', 'top', 'topic', 'topple', 'tornado', 'tortoise',
  'toss', 'total', 'tourist', 'toward', 'tower', 'town', 'toy', 'track', 'trade', 'traffic',
  'tragic', 'train', 'transfer', 'trap', 'trash', 'travel', 'tray', 'treat', 'tree', 'trend',
  'trial', 'tribe', 'trick', 'trigger', 'trim', 'trip', 'trophy', 'tropical', 'trouble', 'truck',
  'true', 'truly', 'trumpet', 'trust', 'truth', 'try', 'tube', 'tumble', 'tuna', 'tune',
  'turkey', 'turn', 'turtle', 'twelve', 'twenty', 'twice', 'twin', 'twist', 'two', 'type',
  'typical', 'ugly', 'umbrella', 'unable', 'unaware', 'uncle', 'uncover', 'under', 'undo', 'unfair',
  'unfold', 'unhappy', 'uniform', 'unique', 'unit', 'universe', 'unknown', 'unlock', 'until', 'unusual',
  'unveil', 'update', 'upgrade', 'uphold', 'upper', 'upset', 'urban', 'urge', 'usage', 'used',
  'useful', 'useless', 'usual', 'utility', 'vacant', 'vacuum', 'vague', 'valid', 'valley', 'valve',
  'vanish', 'vapor', 'various', 'vast', 'vault', 'vector', 'vehicle', 'velvet', 'vendor', 'venture',
  'venue', 'verb', 'verify', 'version', 'vessel', 'veteran', 'viable', 'vibrant', 'vicious', 'victim',
  'video', 'view', 'village', 'vintage', 'violin', 'virtual', 'virus', 'visa', 'visit', 'visual',
  'vital', 'vivid', 'vocal', 'voice', 'volcano', 'volume', 'vote', 'voyage', 'wage', 'wagon',
  'waist', 'walk', 'wall', 'wallet', 'walnut', 'wander', 'want', 'warfare', 'warm', 'warrior',
  'wash', 'wasp', 'waste', 'water', 'wave', 'way', 'wealth', 'weapon', 'wear', 'weasel',
  'weather', 'web', 'wedding', 'weed', 'week', 'weight', 'welcome', 'well', 'west', 'wet',
  'whale', 'wheat', 'wheel', 'when', 'where', 'whip', 'whisper', 'wide', 'width', 'wife',
  'wild', 'will', 'win', 'window', 'wine', 'wing', 'wink', 'winner', 'winter', 'wire',
  'wisdom', 'wise', 'wish', 'witness', 'wolf', 'woman', 'wonder', 'wood', 'wool', 'word',
  'work', 'world', 'worry', 'worth', 'wrap', 'wreck', 'wrestle', 'wrist', 'write', 'wrong',
  'yard', 'year', 'yellow', 'you', 'young', 'youth', 'zebra', 'zero', 'zone', 'zoo',
];

function generatePasscode() {
  const selected = [];
  for (let i = 0; i < 6; i++) {
    const idx = crypto.randomInt(0, WORDS.length);
    selected.push(WORDS[idx]);
  }
  return selected.join('-');
}

async function getUserByUsername(username) {
  return await get('SELECT * FROM users WHERE username = ?', [username]);
}

async function getUserByRegNo(regNo) {
  return await get(`
    SELECT u.* FROM users u
    JOIN students s ON u.id = s.user_id
    WHERE s.reg_no = ?
  `, [regNo]);
}

async function getUserById(id) {
  return await get('SELECT * FROM users WHERE id = ?', [id]);
}

async function createUser(username, password, role, mustChangePassword = true) {
  const hashed = await bcrypt.hash(password, 10);
  return await run('INSERT INTO users (username, password, role, must_change_password) VALUES (?, ?, ?, ?)',
    [username, hashed, role, mustChangePassword ? 1 : 0]);
}

async function createStudentWithUser(username, password, firstName, middleName, lastName, age, classId, regNo, email = null) {
  const hashed = await bcrypt.hash(password, 10);

  try {
    await run('INSERT INTO users (username, password, role, must_change_password) VALUES (?, ?, ?, ?)',
      [username, hashed, 'student', 1]);

    const user = await get('SELECT id FROM users WHERE username = ?', [username]);
    if (!user) {
      throw new Error('Failed to create user');
    }
    const userId = user.id;

    try {
      await run('INSERT INTO students (user_id, first_name, middle_name, last_name, age, class_id, reg_no, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, firstName, middleName || null, lastName, age, classId, regNo, email]);
      return userId;
    } catch (error) {
      await run('DELETE FROM users WHERE id = ?', [userId]);
      throw new Error('Failed to create student record: ' + error.message);
    }
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed: users.username')) {
      throw new Error('Username already exists');
    }
    throw error;
  }
}

async function createTeacherWithUser(username, password, firstName, middleName, lastName, classId = null) {
  const hashed = await bcrypt.hash(password, 10);

  try {
    await run('INSERT INTO users (username, password, role, must_change_password) VALUES (?, ?, ?, ?)',
      [username, hashed, 'teacher', 1]);

    const user = await get('SELECT id FROM users WHERE username = ?', [username]);
    if (!user) {
      throw new Error('Failed to create user');
    }
    const userId = user.id;

    try {
      await run('INSERT INTO teachers (user_id, first_name, middle_name, last_name, class_id) VALUES (?, ?, ?, ?, ?)', [userId, firstName, middleName || null, lastName, classId]);
      return userId;
    } catch (error) {
      await run('DELETE FROM users WHERE id = ?', [userId]);
      throw new Error('Failed to create teacher record: ' + error.message);
    }
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed: users.username')) {
      throw new Error('Username already exists');
    }
    throw error;
  }
}

async function updateUserPassword(userId, password) {
  const hashed = await bcrypt.hash(password, 10);
  await run('UPDATE users SET password = ?, must_change_password = 0 WHERE id = ?', [hashed, userId]);
}

async function resetUserPassword(userId) {
  const hashed = await bcrypt.hash('12345678', 10);
  await run('UPDATE users SET password = ?, must_change_password = 1 WHERE id = ?', [hashed, userId]);
}

function validatePassword(user, password) {
  return bcrypt.compare(password, user.password);
}

async function createStudent(userId, firstName, middleName, lastName, age, classId, regNo) {
  return await run('INSERT INTO students (user_id, first_name, middle_name, last_name, age, class_id, reg_no) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userId, firstName, middleName || null, lastName, age, classId, regNo]);
}

async function createTeacher(userId, firstName, middleName, lastName, classId = null) {
  return await run('INSERT INTO teachers (user_id, first_name, middle_name, last_name, class_id) VALUES (?, ?, ?, ?, ?)', [userId, firstName, middleName || null, lastName, classId]);
}

async function getStudentByUserId(userId) {
  return await get('SELECT s.*, c.name as class_name, c.arm as class_arm, u.username FROM students s JOIN classes c ON s.class_id = c.id JOIN users u ON s.user_id = u.id WHERE s.user_id = ?', [userId]);
}

async function getStudentById(studentId) {
  return await get('SELECT s.*, c.name as class_name, c.arm as class_arm, u.username FROM students s JOIN classes c ON s.class_id = c.id JOIN users u ON s.user_id = u.id WHERE s.id = ?', [studentId]);
}

async function getTeacherByUserId(userId) {
  return await get('SELECT t.*, u.username, c.name as class_name, c.arm as class_arm FROM teachers t JOIN users u ON t.user_id = u.id LEFT JOIN classes c ON t.class_id = c.id WHERE t.user_id = ?', [userId]);
}

async function generateRegNo() {
  const year = String(new Date().getFullYear()).slice(-2);
  const prefix = `${year}/`;
  const last = await get("SELECT reg_no FROM students WHERE reg_no LIKE ? ORDER BY id DESC LIMIT 1", [prefix + '%']);
  let num = 1;
  if (last) {
    const parts = last.reg_no.split('/');
    if (parts.length === 2) num = parseInt(parts[1]) + 1;
  }
  return prefix + String(num).padStart(4, '0');
}

async function getAllClasses() {
  return await query('SELECT * FROM classes ORDER BY name, arm');
}

async function createClass(name, arm) {
  return await run('INSERT INTO classes (name, arm) VALUES (?, ?)', [name, arm]);
}

async function deleteClass(id) {
  return await run('DELETE FROM classes WHERE id = ?', [id]);
}

async function getAllSubjects() {
  return await query('SELECT * FROM subjects ORDER BY name');
}

async function createSubject(name) {
  return await run('INSERT INTO subjects (name) VALUES (?)', [name]);
}

async function getClassSubjects() {
  return await query(`
    SELECT cs.id, c.name as class_name, c.arm as class_arm, c.id as class_id,
           s.name as subject_name, s.id as subject_id,
           t.id as teacher_id, t.first_name || ' ' || COALESCE(t.middle_name || ' ', '') || t.last_name as teacher_name
    FROM class_subjects cs
    JOIN classes c ON cs.class_id = c.id
    JOIN subjects s ON cs.subject_id = s.id
    LEFT JOIN teachers t ON cs.teacher_id = t.id
    ORDER BY c.name, c.arm, s.name
  `);
}

async function assignClassSubject(classId, subjectId, teacherId) {
  return await run('INSERT INTO class_subjects (class_id, subject_id, teacher_id) VALUES (?, ?, ?)',
    [classId, subjectId, teacherId || null]);
}

async function getAllTeachers() {
  return await query(`
    SELECT t.*, u.username, u.must_change_password, c.name as class_name, c.arm as class_arm,
           CASE WHEN o.lock_level = 3 THEN 1 WHEN o.locked_until > datetime('now') THEN 1 ELSE 0 END as is_locked,
           o.lock_level
    FROM teachers t
    JOIN users u ON t.user_id = u.id
    LEFT JOIN classes c ON t.class_id = c.id
    LEFT JOIN otp_lockouts o ON o.user_id = u.id
    ORDER BY t.last_name, t.first_name
  `);
}

async function getAllStudents() {
  return await query(`
    SELECT s.id, s.reg_no, s.first_name, s.middle_name, s.last_name, s.age, s.class_id, s.email,
           c.name as class_name, c.arm as class_arm, u.username, u.must_change_password,
           CASE WHEN o.lock_level = 3 THEN 1 WHEN o.locked_until > datetime('now') THEN 1 ELSE 0 END as is_locked,
           o.lock_level
    FROM students s
    JOIN classes c ON s.class_id = c.id
    JOIN users u ON s.user_id = u.id
    LEFT JOIN otp_lockouts o ON o.user_id = u.id
    ORDER BY s.reg_no
  `);
}

async function deleteStudent(id) {
  const student = await get('SELECT user_id FROM students WHERE id = ?', [id]);
  if (student) {
    await run('DELETE FROM students WHERE id = ?', [id]);
    await run('DELETE FROM users WHERE id = ?', [student.user_id]);
  }
}

async function updateTeacherClass(teacherId, classId) {
  return await run('UPDATE teachers SET class_id = ? WHERE id = ?', [classId, teacherId]);
}

async function updateStudent(id, firstName, middleName, lastName, age, classId) {
  const student = await get('SELECT s.class_id FROM students s WHERE s.id = ?', [id]);
  if (!student) throw new Error('Student not found');

  await run('UPDATE students SET first_name = ?, middle_name = ?, last_name = ?, age = ?, class_id = ? WHERE id = ?',
    [firstName, middleName || null, lastName, age, classId, id]);
}

async function updateTeacher(id, firstName, middleName, lastName, classId) {
  await run('UPDATE teachers SET first_name = ?, middle_name = ?, last_name = ?, class_id = ? WHERE id = ?',
    [firstName, middleName || null, lastName, classId || null, id]);
}

async function deleteTeacher(id) {
  const teacher = await get('SELECT user_id FROM teachers WHERE id = ?', [id]);
  if (teacher) {
    await run('DELETE FROM teachers WHERE id = ?', [id]);
    await run('DELETE FROM users WHERE id = ?', [teacher.user_id]);
  }
}

async function getGradingSystem() {
  return await query('SELECT * FROM grading_system ORDER BY min_score DESC');
}

async function addGrade(grade, minScore, maxScore, remark) {
  return await run('INSERT INTO grading_system (grade, min_score, max_score, remark) VALUES (?, ?, ?, ?)',
    [grade, minScore, maxScore, remark]);
}

async function deleteGrade(id) {
  return await run('DELETE FROM grading_system WHERE id = ?', [id]);
}

async function calculateGrade(total) {
  const grades = await getGradingSystem();
  for (const g of grades) {
    if (total >= g.min_score && total <= g.max_score) {
      return g.grade;
    }
  }
  return 'F';
}

async function getResultsForTeacher(teacherId, sessionId = null, termId = null) {
  const teacher = await get('SELECT class_id FROM teachers WHERE id = ?', [teacherId]);

  let sql = `
    SELECT r.*, s.reg_no, s.first_name, s.last_name, s.middle_name, s.class_id, c.name as class_name, c.arm as class_arm,
           sub.name as subject_name, u.username as student_username
    FROM results r
    JOIN students s ON r.student_id = s.id
    JOIN classes c ON s.class_id = c.id
    JOIN subjects sub ON r.subject_id = sub.id
    JOIN users u ON s.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (teacher && teacher.class_id) {
    sql += ` AND s.class_id = ?`;
    params.push(teacher.class_id);
  } else {
    sql += ` AND r.subject_id IN (SELECT subject_id FROM class_subjects WHERE teacher_id = ?)`;
    params.push(teacherId);
  }

  if (sessionId) {
    sql += ` AND (r.session_id = ? OR (r.session_id IS NULL AND r.session = (SELECT name FROM sessions WHERE id = ?)))`;
    params.push(sessionId, sessionId);
  }
  if (termId) {
    sql += ` AND (r.term_id = ? OR (r.term_id IS NULL AND r.term = (SELECT name FROM terms WHERE id = ?)))`;
    params.push(termId, termId);
  }

  return await query(sql + ` ORDER BY r.id DESC`, params);
}

async function getPendingResults(sessionId = null, termId = null) {
  let sql = `
    SELECT r.*, s.reg_no, s.first_name, s.last_name, s.middle_name, c.name as class_name, c.arm as class_arm,
           sub.name as subject_name, u.username as student_username
    FROM results r
    JOIN students s ON r.student_id = s.id
    JOIN classes c ON s.class_id = c.id
    JOIN subjects sub ON r.subject_id = sub.id
    JOIN users u ON s.user_id = u.id
    WHERE r.status = 'pending'
  `;
  const params = [];

  if (sessionId) {
    sql += ` AND (r.session_id = ? OR (r.session_id IS NULL AND r.session = (SELECT name FROM sessions WHERE id = ?)))`;
    params.push(sessionId, sessionId);
  }
  if (termId) {
    sql += ` AND (r.term_id = ? OR (r.term_id IS NULL AND r.term = (SELECT name FROM terms WHERE id = ?)))`;
    params.push(termId, termId);
  }

  return await query(sql + ` ORDER BY r.id DESC`, params);
}

async function getAllResults(sessionId = null, termId = null) {
  let sql = `
    SELECT r.*, s.reg_no, s.first_name, s.last_name, s.middle_name, c.name as class_name, c.arm as class_arm,
           sub.name as subject_name, u.username as student_username
    FROM results r
    JOIN students s ON r.student_id = s.id
    JOIN classes c ON s.class_id = c.id
    JOIN subjects sub ON r.subject_id = sub.id
    JOIN users u ON s.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (sessionId) {
    sql += ` AND (r.session_id = ? OR (r.session_id IS NULL AND r.session = (SELECT name FROM sessions WHERE id = ?)))`;
    params.push(sessionId, sessionId);
  }
  if (termId) {
    sql += ` AND (r.term_id = ? OR (r.term_id IS NULL AND r.term = (SELECT name FROM terms WHERE id = ?)))`;
    params.push(termId, termId);
  }

  return await query(sql + ` ORDER BY r.id DESC`, params);
}

async function upsertResult(studentId, subjectId, caScore, examScore, total, grade, status, term, session, sessionId = null, termId = null) {
  await run(`INSERT OR REPLACE INTO results (student_id, subject_id, ca_score, exam_score, total, grade, status, term, session, session_id, term_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [studentId, subjectId, caScore, examScore, total, grade, status, term, session, sessionId, termId]);
}

async function approveResult(id) {
  return await run("UPDATE results SET status = 'approved' WHERE id = ?", [id]);
}

async function rejectResult(id) {
  return await run("UPDATE results SET status = 'rejected' WHERE id = ?", [id]);
}

async function getStudentsByClassId(classId, teacherId = null) {
  let params = [classId];
  let teacherFilter = '';

  if (teacherId) {
    const teacher = await get('SELECT class_id FROM teachers WHERE id = ?', [teacherId]);
    if (teacher && teacher.class_id) {
      teacherFilter = ` AND s.class_id = ?`;
      params = [teacher.class_id];
    }
  }

  return await query(`
    SELECT s.*, u.username
    FROM students s
    JOIN users u ON s.user_id = u.id
    WHERE s.class_id = ? ${teacherFilter}
    ORDER BY s.last_name, s.first_name
  `, params);
}

async function upsertAttendance(studentId, date, status, markedBy, sessionId = null, termId = null) {
  await run(`INSERT INTO attendance (student_id, date, status, marked_by, session_id, term_id)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(student_id, date) DO UPDATE SET status = ?, marked_by = ?, session_id = ?, term_id = ?`,
    [studentId, date, status, markedBy, sessionId, termId, status, markedBy, sessionId, termId]);
}

async function getAttendanceByTeacher(teacherId) {
  return await query(`
    SELECT a.*, s.reg_no, s.first_name, s.last_name, s.middle_name, c.name as class_name, c.arm as class_arm,
           u.username as marked_by_name
    FROM attendance a
    JOIN students s ON a.student_id = s.id
    JOIN classes c ON s.class_id = c.id
    JOIN users u ON a.marked_by = (SELECT t.user_id FROM teachers t WHERE t.id = a.marked_by)
    WHERE a.marked_by = ?
    ORDER BY a.date DESC
    LIMIT 100
  `, [teacherId]);
}

async function getStudentAttendance(studentId) {
  return await query(`
    SELECT a.*, u.username as marked_by_name
    FROM attendance a
    JOIN teachers t ON a.marked_by = t.id
    JOIN users u ON t.user_id = u.id
    WHERE a.student_id = ?
    ORDER BY a.date DESC
  `, [studentId]);
}

async function getAllAttendance(date, classId, sessionId = null, termId = null) {
  let sql = `
    SELECT a.*, s.reg_no, s.first_name, s.last_name, s.middle_name,
           s.first_name || ' ' || COALESCE(s.middle_name || ' ', '') || s.last_name as student_name,
           c.name as class_name, c.arm as class_arm,
           u.username as marked_by_name
    FROM attendance a
    JOIN students s ON a.student_id = s.id
    JOIN classes c ON s.class_id = c.id
    JOIN teachers t ON a.marked_by = t.id
    JOIN users u ON t.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (date) {
    sql += ' AND a.date = ?';
    params.push(date);
  }
  if (classId) {
    sql += ' AND s.class_id = ?';
    params.push(classId);
  }
   if (sessionId) {
    sql += ' AND a.session_id = ?';
    params.push(sessionId);
  }
  if (termId) {
    sql += ' AND a.term_id = ?';
    params.push(termId);
  }

  sql += ' ORDER BY a.date DESC';
  return await query(sql, params);
}

async function getStudentResults(studentId, sessionId = null, termId = null) {
  let sql = `
    SELECT r.*, sub.name as subject_name
    FROM results r
    JOIN subjects sub ON r.subject_id = sub.id
    WHERE r.student_id = ? AND r.status = 'approved'
  `;
  const params = [studentId];

  if (sessionId) {
    sql += ` AND (r.session_id = ? OR (r.session_id IS NULL AND r.session = (SELECT name FROM sessions WHERE id = ?)))`;
    params.push(sessionId, sessionId);
  }
  if (termId) {
    sql += ` AND (r.term_id = ? OR (r.term_id IS NULL AND r.term = (SELECT name FROM terms WHERE id = ?)))`;
    params.push(termId, termId);
  }

  return await query(sql + ` ORDER BY r.session DESC, r.term DESC`, params);
}

async function getPendingResultCount(studentId, sessionId = null, termId = null) {
  let sql = `SELECT COUNT(*) as count FROM results WHERE student_id = ? AND status = 'pending'`;
  const params = [studentId];

  if (sessionId) {
    sql += ` AND (session_id = ? OR (session_id IS NULL AND session = (SELECT name FROM sessions WHERE id = ?)))`;
    params.push(sessionId, sessionId);
  }
  if (termId) {
    sql += ` AND (term_id = ? OR (term_id IS NULL AND term = (SELECT name FROM terms WHERE id = ?)))`;
    params.push(termId, termId);
  }

  const result = await get(sql, params);
  return result ? result.count : 0;
}

async function getTeacherAssignedSubjects(teacherId) {
  const teacher = await get('SELECT class_id FROM teachers WHERE id = ?', [teacherId]);

  let params = [teacherId];
  let classFilter = '';

  if (teacher && teacher.class_id) {
    classFilter = ` AND cs.class_id = ?`;
    params.push(teacher.class_id);
  }

  const sql = `SELECT cs.id, cs.class_id, cs.subject_id, cs.teacher_id, c.name as class_name, c.arm as class_arm, s.name as subject_name
    FROM class_subjects cs
    JOIN classes c ON cs.class_id = c.id
    JOIN subjects s ON cs.subject_id = s.id
    WHERE cs.teacher_id = ? ${classFilter}
    ORDER BY c.name, c.arm, s.name`;

  return await query(sql, params);
}

async function getStudentSubjects(classId) {
  return await query(`
    SELECT cs.id, c.name as class_name, c.arm as class_arm,
           s.name as subject_name, s.id as subject_id,
           t.id as teacher_id, t.first_name || ' ' || COALESCE(t.middle_name || ' ', '') || t.last_name as teacher_name
    FROM class_subjects cs
    JOIN classes c ON cs.class_id = c.id
    JOIN subjects s ON cs.subject_id = s.id
    LEFT JOIN teachers t ON cs.teacher_id = t.id
    WHERE cs.class_id = ?
    ORDER BY s.name
  `, [classId]);
}

async function getClassSubjectById(id) {
  return await query(`
    SELECT cs.*, c.name as class_name, c.arm as class_arm, c.id as class_id,
           s.name as subject_name, s.id as subject_id
    FROM class_subjects cs
    JOIN classes c ON cs.class_id = c.id
    JOIN subjects s ON cs.subject_id = s.id
    WHERE cs.id = ?
  `, [id]);
}

async function getTodayAttendanceForClass(classId, date) {
  return await query(`
    SELECT student_id, status
    FROM attendance
    WHERE date = ? AND student_id IN (SELECT id FROM students WHERE class_id = ?)
  `, [date, classId]);
}

async function getAttendanceDatesForClass(classId) {
  return await query(`
    SELECT DISTINCT date
    FROM attendance
    WHERE student_id IN (SELECT id FROM students WHERE class_id = ?)
    ORDER BY date DESC
  `, [classId]);
}

async function getAttendanceForDate(classId, date) {
  return await query(`
    SELECT a.student_id, s.reg_no, s.first_name, s.middle_name, s.last_name,
           s.first_name || ' ' || COALESCE(s.middle_name || ' ', '') || s.last_name as student_name,
           a.date, a.status, u.username as marked_by_name
    FROM attendance a
    JOIN students s ON a.student_id = s.id
    JOIN teachers t ON a.marked_by = t.id
    JOIN users u ON t.user_id = u.id
    WHERE a.date = ? AND s.class_id = ?
    ORDER BY s.last_name, s.first_name
  `, [date, classId]);
}

async function seedDefaultData() {
  const adminExists = await get('SELECT id FROM users WHERE username = ?', ['admin']);
  if (!adminExists) {
    await createUser('admin', 'admin123', 'admin', false);
    console.log('Default admin created: username=admin, password=admin123');
  }

  const gradesExist = await get('SELECT id FROM grading_system LIMIT 1');
  if (!gradesExist) {
    const grades = [
      { grade: 'A', min_score: 70, max_score: 100, remark: 'Excellent' },
      { grade: 'B', min_score: 60, max_score: 69, remark: 'Very Good' },
      { grade: 'C', min_score: 50, max_score: 59, remark: 'Good' },
      { grade: 'D', min_score: 45, max_score: 49, remark: 'Pass' },
      { grade: 'E', min_score: 40, max_score: 44, remark: 'Fair' },
      { grade: 'F', min_score: 0, max_score: 39, remark: 'Fail' },
    ];
    for (const g of grades) {
      await addGrade(g.grade, g.min_score, g.max_score, g.remark);
    }
    console.log('Default grading system created');
  }

  const classesExist = await get('SELECT id FROM classes LIMIT 1');
  if (!classesExist) {
    const levels = ['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3'];
    const arms = ['A', 'B', 'C'];
    for (const level of levels) {
      for (const arm of arms) {
        await createClass(level, arm);
      }
    }
    console.log('Default classes created');
  }

  const subjectsExist = await get('SELECT id FROM subjects LIMIT 1');
  if (!subjectsExist) {
    const subjectNames = [
      'Mathematics', 'English Language', 'Basic Science', 'Physics',
      'Chemistry', 'Biology', 'Economics', 'Government',
      'Literature in English', 'Civic Education', 'Data Processing',
      'Agricultural Science', 'Geography', 'History',
      'Computer Studies', 'Business Studies',
      'Yoruba', 'Igbo', 'Hausa', 'French',
    ];
    for (const name of subjectNames) {
      await createSubject(name);
    }
    console.log('Default subjects created');
  }

  const sessionExists = await get('SELECT id FROM sessions LIMIT 1');
  if (!sessionExists) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const sessionName = month >= 9 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
    const currentSessionId = await run('INSERT INTO sessions (name, is_active) VALUES (?, 1)', [sessionName]);
    const termNames = ['First Term', 'Second Term', 'Third Term'];
    for (let i = 0; i < termNames.length; i++) {
      await run('INSERT INTO terms (name, session_id, is_active) VALUES (?, ?, ?)',
        [termNames[i], currentSessionId, i === 0 ? 1 : 0]);
    }
    console.log('Default session and terms created');
  }

  const settingExists = await get("SELECT key FROM settings WHERE key = 'current_session_id'");
  if (!settingExists) {
    const activeSession = await get('SELECT id FROM sessions WHERE is_active = 1 LIMIT 1');
    if (activeSession) {
      await run("INSERT INTO settings (key, value) VALUES ('current_session_id', ?)", [String(activeSession.id)]);
      const activeTerm = await get('SELECT id FROM terms WHERE is_active = 1 LIMIT 1');
      if (activeTerm) {
        await run("INSERT INTO settings (key, value) VALUES ('current_term_id', ?)", [String(activeTerm.id)]);
      }
    }
  }
}

async function getCurrentSession() {
  const setting = await get("SELECT value FROM settings WHERE key = 'current_session_id'");
  if (!setting) return null;
  return await get('SELECT * FROM sessions WHERE id = ?', [parseInt(setting.value)]);
}

async function getCurrentTerm() {
  const setting = await get("SELECT value FROM settings WHERE key = 'current_term_id'");
  if (!setting) return null;
  return await get('SELECT * FROM terms WHERE id = ?', [parseInt(setting.value)]);
}

async function getAllSessions() {
  return await query('SELECT * FROM sessions ORDER BY name DESC');
}

async function createSession(name) {
  return await run('INSERT INTO sessions (name, is_active) VALUES (?, 0)', [name]);
}

async function deleteSession(id) {
  const isActive = await get('SELECT is_active FROM sessions WHERE id = ?', [id]);
  if (isActive && isActive.is_active) return null;
  await run('DELETE FROM terms WHERE session_id = ?', [id]);
  return await run('DELETE FROM sessions WHERE id = ?', [id]);
}

async function setActiveSession(id) {
  await run('UPDATE sessions SET is_active = 0 WHERE 1=1');
  await run('UPDATE sessions SET is_active = 1 WHERE id = ?', [id]);
  await run("UPDATE settings SET value = ? WHERE key = 'current_session_id'", [String(id)]);

  const firstTerm = await get('SELECT id FROM terms WHERE session_id = ? ORDER BY name ASC LIMIT 1', [id]);
  if (firstTerm) {
    await setActiveTerm(firstTerm.id);
  }
}

async function getTermsBySession(sessionId) {
  return await query('SELECT * FROM terms WHERE session_id = ? ORDER BY name ASC', [sessionId]);
}

async function createTerm(name, sessionId) {
  return await run('INSERT INTO terms (name, session_id, is_active) VALUES (?, ?, 0)', [name, sessionId]);
}

async function deleteTerm(id) {
  const isActive = await get('SELECT is_active FROM terms WHERE id = ?', [id]);
  if (isActive && isActive.is_active) return null;
  return await run('DELETE FROM terms WHERE id = ?', [id]);
}

async function setActiveTerm(id) {
  const term = await get('SELECT * FROM terms WHERE id = ?', [id]);
  if (!term) {
    throw new Error('Term not found');
  }
  
  const currentSessionSetting = await get("SELECT value FROM settings WHERE key = 'current_session_id'");
  const currentSessionId = currentSessionSetting ? parseInt(currentSessionSetting.value) : null;
  
  if (currentSessionId !== null && term.session_id !== currentSessionId) {
    const termSession = await get('SELECT name FROM sessions WHERE id = ?', [term.session_id]);
    const currentSession = await get('SELECT name FROM sessions WHERE id = ?', [currentSessionId]);
    throw new Error(`Cannot activate "${term.name}" from session "${termSession?.name || 'Unknown'}" when current session is "${currentSession?.name || 'Unknown'}"`);
  }
  
  await run('UPDATE terms SET is_active = 0 WHERE 1=1');
  await run('UPDATE terms SET is_active = 1 WHERE id = ?', [id]);
  await run("UPDATE settings SET value = ? WHERE key = 'current_term_id'", [String(id)]);
}

async function promoteStudents() {
  const students = await query('SELECT s.*, c.name as class_name FROM students s JOIN classes c ON s.class_id = c.id');
  let promotedCount = 0;
  let noPromotionCount = 0;

  console.log(`[Promotion] Processing ${students.length} students`);

  for (const student of students) {
    const nextClass = CLASS_PROMOTION_ORDER[student.class_name];
    if (!nextClass) {
      console.log(`[Promotion] Skipping ${student.first_name} ${student.last_name} - class ${student.class_name} has no promotion path`);
      noPromotionCount++;
      continue;
    }

    const nextClassObj = await get('SELECT id FROM classes WHERE name = ?', [nextClass]);
    if (!nextClassObj) {
      console.log(`[Promotion] Skipping ${student.first_name} ${student.last_name} - next class ${nextClass} not found in database`);
      noPromotionCount++;
      continue;
    }

    await run('UPDATE students SET class_id = ? WHERE id = ?', [nextClassObj.id, student.id]);
    console.log(`[Promotion] ${student.first_name} ${student.last_name}: ${student.class_name} -> ${nextClass}`);
    promotedCount++;
  }

  console.log(`[Promotion] Done. Promoted: ${promotedCount}, Skipped: ${noPromotionCount}`);
  return { promotedCount, noPromotionCount };
}

async function updateStudentEmail(studentId, email) {
  return await run('UPDATE students SET email = ? WHERE id = ?', [email, studentId]);
}

async function getStudentsWithoutEmail() {
  return await query("SELECT s.*, u.username FROM students s JOIN users u ON s.user_id = u.id WHERE s.email IS NULL OR s.email = ''");
}

async function getEmailSetting(key) {
  const row = await get("SELECT value FROM email_settings WHERE key = ?", [key]);
  return row ? row.value : null;
}

async function setEmailSetting(key, value) {
  if (isPostgres) {
    await run("INSERT INTO email_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value", [key, value]);
  } else {
    await run("INSERT OR REPLACE INTO email_settings (key, value) VALUES (?, ?)", [key, value]);
  }
}

const { isEmailConfigured, sendEmail } = require('../utils/email');
const { generateResultPdf } = require('../utils/resultPdf');

async function sendResultApprovalEmail(studentId) {
  if (!isEmailConfigured()) {
    console.log('[Email] Not configured, skipping notification');
    return false;
  }

  const studentRows = await query(`
    SELECT s.email, s.first_name, s.last_name, c.name as class_name, c.arm as class_arm,
           u.username
    FROM students s
    JOIN classes c ON s.class_id = c.id
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ?
  `, [studentId]);
  const student = studentRows[0];

  if (!student || !student.email) {
    console.log(`[Email] Student ${studentId} has no email, skipping`);
    return false;
  }

  const school = await getSchoolSettings();
  const schoolName = school.school_name || 'SIMS';
  const currentSession = await getCurrentSession();
  const currentTerm = await getCurrentTerm();
  const sessionName = currentSession ? currentSession.name : 'N/A';
  const termName = currentTerm ? currentTerm.name : 'N/A';

  const subject = `Your result is ready - ${schoolName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2c3e50;">Result Notification</h2>
      <p>Dear <strong>${student.first_name} ${student.last_name}</strong>,</p>
      <p>Your result for <strong>${termName}, ${sessionName}</strong> has been approved and is now available.</p>
      <p>Please log in to the ${schoolName} portal to view your result.</p>
      <hr>
      <p style="color: #6c757d; font-size: 0.85rem;">This is an automated message from ${schoolName}. Do not reply to this email.</p>
    </div>
  `;

  return await sendEmail(student.email, subject, html);
}

async function sendResultEditEmail(resultId) {
  if (!isEmailConfigured()) {
    console.log('[Email] Not configured, skipping notification');
    return false;
  }

  const resultRows = await query(`
    SELECT r.*, s.email, s.first_name, s.last_name, s.middle_name,
           c.name as class_name, c.arm as class_arm,
           sub.name as subject_name, u.username
    FROM results r
    JOIN students s ON r.student_id = s.id
    JOIN classes c ON s.class_id = c.id
    JOIN subjects sub ON r.subject_id = sub.id
    JOIN users u ON s.user_id = u.id
    WHERE r.id = ?
  `, [resultId]);
  const result = resultRows[0];

  if (!result || !result.email) {
    console.log(`[Email] Result ${resultId} has no student email, skipping`);
    return false;
  }

  const school = await getSchoolSettings();
  const schoolName = school.school_name || 'SIMS';
  const subject = `Your result has been updated - ${schoolName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2c3e50;">Result Update Notification</h2>
      <p>Dear <strong>${result.first_name} ${result.last_name}</strong>,</p>
      <p>Your result for <strong>${result.subject_name}</strong> has been updated:</p>
      <ul>
        <li>CA Score: ${result.ca_score}</li>
        <li>Exam Score: ${result.exam_score}</li>
        <li>Total: ${result.total}</li>
        <li>Grade: ${result.grade}</li>
      </ul>
      <p>Term: <strong>${result.term}</strong> | Session: <strong>${result.session}</strong></p>
      <p>Please log in to the ${schoolName} portal to view your full results.</p>
      <hr>
      <p style="color: #6c757d; font-size: 0.85rem;">This is an automated message from ${schoolName}. Do not reply to this email.</p>
    </div>
  `;

  return await sendEmail(result.email, subject, html);
}

async function sendAttendanceNotification(studentId, status, date, termName, sessionName) {
  if (!isEmailConfigured()) {
    console.log('[Email] Not configured, skipping notification');
    return false;
  }

  const studentRows = await query(`
    SELECT s.email, s.first_name, s.last_name, c.name as class_name, c.arm as class_arm
    FROM students s
    JOIN classes c ON s.class_id = c.id
    WHERE s.id = ?
  `, [studentId]);
  const student = studentRows[0];

  if (!student || !student.email) {
    console.log(`[Email] Student ${studentId} has no email, skipping`);
    return false;
  }

  const school = await getSchoolSettings();
  const schoolName = school.school_name || 'SIMS';
  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('en-NG', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

  const subject = `Attendance ${statusLabel} - ${formattedDate}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2c3e50;">Attendance Notification</h2>
      <p>Dear <strong>${student.first_name} ${student.last_name}</strong>,</p>
      <p>Your attendance has been marked for <strong>${formattedDate}</strong>:</p>
      <p style="font-size: 1.2rem;"><strong>Status: ${statusLabel}</strong></p>
      <p>Class: <strong>${student.class_name} ${student.class_arm}</strong></p>
      <p>Term: <strong>${termName}</strong> | Session: <strong>${sessionName}</strong></p>
      <hr>
      <p style="color: #6c757d; font-size: 0.85rem;">This is an automated message from ${schoolName}. Do not reply to this email.</p>
    </div>
  `;

  return await sendEmail(student.email, subject, html);
}

async function sendNewsletter(subject, htmlBody, filter = {}) {
  if (!isEmailConfigured()) {
    console.log('[Email] Not configured, skipping newsletter');
    return { sent: 0, failed: 0, message: 'Email not configured' };
  }

  let students;
  if (filter.class_id) {
    students = await query("SELECT s.id, s.email, s.first_name, s.last_name FROM students s WHERE s.class_id = ? AND s.email IS NOT NULL AND s.email != ''", [filter.class_id]);
  } else if (filter.student_ids && filter.student_ids.length > 0) {
    const placeholders = filter.student_ids.map(() => '?').join(',');
    students = await query(`SELECT id, email, first_name, last_name FROM students WHERE id IN (${placeholders}) AND email IS NOT NULL AND email != ''`, filter.student_ids);
  } else {
    students = await query("SELECT id, email, first_name, last_name FROM students WHERE email IS NOT NULL AND email != ''");
  }

  let sent = 0, failed = 0;
  const label = filter.label ? ` (${filter.label})` : '';

  for (const student of students) {
    const personalized = htmlBody.replace(/{name}/g, `${student.first_name} ${student.last_name}`);
    const wrapped = `
      <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:10px 14px;margin-bottom:16px;font-size:0.85rem;color:#856404">
        <strong><i class="bi bi-megaphone"></i> Mass Email Notice:</strong> This is a newsletter sent to all students. If you have questions, please contact the school administration.
      </div>
      ${personalized}
    `;
    const result = await sendEmail(student.email, subject, wrapped);
    if (result) sent++; else failed++;
  }

  console.log(`[Newsletter${label}] Sent: ${sent}, Failed: ${failed}, Total: ${students.length}`);
  return { sent, failed, total: students.length };
}

async function sendResultPdfEmail(studentId, sessionId, termId) {
  if (!isEmailConfigured()) {
    return { success: false, message: 'Email not configured' };
  }

  const student = await getStudentById(studentId);
  if (!student) return { success: false, message: 'Student not found' };
  if (!student.email) return { success: false, message: 'No email address on file' };

  const session = await get('SELECT * FROM sessions WHERE id = ?', [sessionId]);
  const term = await get('SELECT * FROM terms WHERE id = ?', [termId]);
  if (!session || !term) return { success: false, message: 'Session or term not found' };

  const results = await query(`
    SELECT r.*, sub.name as subject_name
    FROM results r
    JOIN subjects sub ON r.subject_id = sub.id
    WHERE r.student_id = ? AND (r.session_id = ? OR (r.session_id IS NULL AND r.session = (SELECT name FROM sessions WHERE id = ?))) AND (r.term_id = ? OR (r.term_id IS NULL AND r.term = (SELECT name FROM terms WHERE id = ?))) AND r.status = 'approved'
    ORDER BY sub.name
  `, [studentId, sessionId, sessionId, termId, termId]);

  if (results.length === 0) return { success: false, message: 'No approved results found' };

  const totalScore = results.reduce((sum, r) => sum + r.total, 0);
  const avgScore = results.length > 0 ? (totalScore / results.length).toFixed(2) : 0;

  const totalAttendanceRow = await get('SELECT COUNT(*) as count FROM attendance WHERE student_id = ? AND session_id = ? AND term_id = ?', [studentId, sessionId, termId]);
  const totalAttendance = totalAttendanceRow.count;
  const presentCountRow = await get("SELECT COUNT(*) as count FROM attendance WHERE student_id = ? AND status = 'present' AND session_id = ? AND term_id = ?", [studentId, sessionId, termId]);
  const presentCount = presentCountRow.count;
  const attendanceRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

  const classRankData = await query(`
    SELECT s.id, SUM(r.total) as total_score
    FROM students s
    JOIN results r ON s.id = r.student_id
    JOIN subjects sub ON r.subject_id = sub.id
    WHERE s.class_id = ? AND r.status = 'approved' AND (r.session_id = ? OR (r.session_id IS NULL AND r.session = (SELECT name FROM sessions WHERE id = ?))) AND (r.term_id = ? OR (r.term_id IS NULL AND r.term = (SELECT name FROM terms WHERE id = ?)))
    GROUP BY s.id
    ORDER BY total_score DESC
  `, [student.class_id, sessionId, sessionId, termId, termId]);

  let classPosition = 0;
  for (let i = 0; i < classRankData.length; i++) {
    if (classRankData[i].id == studentId) {
      classPosition = i + 1;
      break;
    }
  }

  const grades = await getGradingSystem();
  const school = await getSchoolSettings();
    const schoolName = school.school_name || 'SIMS';
    const shortName = school.school_short_name || 'SIMS';

  let verificationCode;
  let codeExists = true;
  while (codeExists) {
    const num = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
    verificationCode = `${shortName}-${new Date().getFullYear()}-${num}`;
    codeExists = !!(await get('SELECT id FROM verifications WHERE code = ?', [verificationCode]));
  }

  const hash = crypto.createHash('sha256').update(results.map(r => `${r.subject_id}:${r.ca_score}:${r.exam_score}:${r.total}:${r.grade}`).join('|')).digest('hex');

  await run('INSERT INTO verifications (code, student_id, session_id, term_id, results_hash) VALUES (?, ?, ?, ?, ?)',
    [verificationCode, studentId, sessionId, termId, hash]);

  const pdfBuffer = await generateResultPdf(student, session, term, results, grades, avgScore, attendanceRate, classPosition, classRankData.length, verificationCode, school);

  const fileName = `${student.reg_no}_${term.name.replace(/\s+/g, '_')}_${session.name.replace('/', '_')}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, '_');

  const smtpHost = await getEmailSetting('smtp_host');
  const smtpPort = await getEmailSetting('smtp_port');
  const smtpUser = await getEmailSetting('smtp_user');
  const smtpPass = await getEmailSetting('smtp_pass');
  const fromName = await getEmailSetting('from_name');

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(smtpPort || '587'),
    secure: parseInt(smtpPort || '587') === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  try {
    await transporter.sendMail({
      from: `"${fromName || schoolName}" <${smtpUser}>`,
      to: student.email,
      subject: `Your Result - ${term.name}, ${session.name}`,
      html: `<p>Dear ${student.first_name},</p><p>Please find your result attached.</p><p>Regards,<br>${schoolName}</p>`,
      attachments: [{ filename: fileName, content: pdfBuffer }],
    });
    console.log(`[Email] Result PDF sent to ${student.email}`);
    return { success: true, message: 'Result sent to your email' };
  } catch (error) {
    console.error(`[Email] Failed to send result PDF:`, error.message);
    return { success: false, message: 'Failed to send email' };
  }
}

async function verifyCode(code) {
  const v = await get('SELECT * FROM verifications WHERE code = ?', [code]);
  if (!v) return null;

  const student = await getStudentById(v.student_id);
  const session = await get('SELECT * FROM sessions WHERE id = ?', [v.session_id]);
  const term = await get('SELECT * FROM terms WHERE id = ?', [v.term_id]);

  const results = await query(`
    SELECT r.*, sub.name as subject_name
    FROM results r
    JOIN subjects sub ON r.subject_id = sub.id
    WHERE r.student_id = ? AND (r.session_id = ? OR (r.session_id IS NULL AND r.session = (SELECT name FROM sessions WHERE id = ?))) AND (r.term_id = ? OR (r.term_id IS NULL AND r.term = (SELECT name FROM terms WHERE id = ?))) AND r.status = 'approved'
    ORDER BY sub.name
  `, [v.student_id, v.session_id, v.session_id, v.term_id, v.term_id]);

  let tampered = false;
  if (v.results_hash) {
    const currentHash = crypto.createHash('sha256').update(results.map(r => `${r.subject_id}:${r.ca_score}:${r.exam_score}:${r.total}:${r.grade}`).join('|')).digest('hex');
    tampered = currentHash !== v.results_hash;
  }

  return { verification: v, student, session, term, results, tampered };
}

async function getUserWithEmail(username) {
  return await get(`
    SELECT u.*, COALESCE(s.email, u.email) as email
    FROM users u
    LEFT JOIN students s ON u.id = s.user_id
    WHERE u.username = ?
  `, [username]);
}

async function getUserWithEmailByRegNo(regNo) {
  return await get(`
    SELECT u.*, s.email
    FROM users u
    JOIN students s ON u.id = s.user_id
    WHERE s.reg_no = ?
  `, [regNo]);
}

async function createPasswordReset(userId, otp, expiresAt) {
  return await run('INSERT INTO password_resets (user_id, otp, expires_at) VALUES (?, ?, ?)',
    [userId, otp, expiresAt]);
}

async function getValidOTP(userId, otp) {
  return await get(`
    SELECT * FROM password_resets
    WHERE user_id = ? AND otp = ? AND used = 0 AND expires_at > datetime('now')
    ORDER BY created_at DESC LIMIT 1
  `, [userId, otp]);
}

async function markOTPUsed(id) {
  await run('UPDATE password_resets SET used = 1 WHERE id = ?', [id]);
}

async function checkOTPLockout(userId) {
  const lockout = await get('SELECT * FROM otp_lockouts WHERE user_id = ?', [userId]);
  if (!lockout) return { locked: false };

  if (lockout.lock_level === 3) {
    return { locked: true, reason: 'permanent', lock_level: 3 };
  }

  if (lockout.locked_until) {
    const now = new Date().toISOString().replace('T', ' ').split('.')[0];
    if (lockout.locked_until > now) {
      return { locked: true, reason: 'temporary', lock_level: lockout.lock_level, locked_until: lockout.locked_until };
    }
    await run("UPDATE otp_lockouts SET locked_until = NULL, updated_at = datetime('now') WHERE user_id = ?", [userId]);
  }

  return { locked: false, failed_attempts: lockout.failed_attempts, lock_level: lockout.lock_level };
}

async function recordFailedOTPAttempt(userId) {
  let lockout = await get('SELECT * FROM otp_lockouts WHERE user_id = ?', [userId]);

  if (!lockout) {
    await run('INSERT INTO otp_lockouts (user_id, failed_attempts) VALUES (?, 1)', [userId]);
    return { locked: false };
  }

  const newAttempts = lockout.failed_attempts + 1;

  if (newAttempts >= 3) {
    const nextLevel = lockout.lock_level + 1;
    let lockedUntil = null;

    if (nextLevel >= 3) {
      lockedUntil = null;
      await run("UPDATE otp_lockouts SET failed_attempts = 0, lock_level = 3, locked_until = NULL, updated_at = datetime('now') WHERE user_id = ?", [userId]);
      return { locked: true, reason: 'permanent', lock_level: 3 };
    }

    const durMs = nextLevel === 1 ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    lockedUntil = new Date(Date.now() + durMs).toISOString().replace('T', ' ').split('.')[0];

    await run('UPDATE otp_lockouts SET failed_attempts = 0, lock_level = ?, locked_until = ?, updated_at = datetime(\'now\') WHERE user_id = ?',
      [nextLevel, lockedUntil, userId]);

    const durLabel = nextLevel === 1 ? '1 hour' : '1 day';
    return { locked: true, reason: 'temporary', lock_level: nextLevel, locked_until: lockedUntil, duration: durLabel };
  }

  await run('UPDATE otp_lockouts SET failed_attempts = ?, updated_at = datetime(\'now\') WHERE user_id = ?',
    [newAttempts, userId]);
  return { locked: false, remaining: 3 - newAttempts };
}

async function resetOTPLockout(userId) {
  await run('DELETE FROM otp_lockouts WHERE user_id = ?', [userId]);
}

async function recordFailedLogin(userId) {
  const user = await get('SELECT login_attempts, locked_until FROM users WHERE id = ?', [userId]);
  if (!user) return { locked: false };

  const now = new Date().toISOString().replace('T', ' ').split('.')[0];
  const until = user.locked_until;

  if (until && until > now) {
    const remaining = Math.ceil((new Date(until + 'Z') - new Date()) / 60000);
    return { locked: true, remaining_minutes: remaining };
  }

  const attempts = (user.login_attempts || 0) + 1;

  if (attempts >= 5) {
    const lockedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString().replace('T', ' ').split('.')[0];
    await run("UPDATE users SET login_attempts = 0, locked_until = ? WHERE id = ?", [lockedUntil, userId]);
    return { locked: true, locked_until: lockedUntil, remaining_minutes: 60 };
  }

  await run("UPDATE users SET login_attempts = ? WHERE id = ?", [attempts, userId]);
  return { locked: false, remaining: 5 - attempts };
}

async function checkLoginLocked(userId) {
  const user = await get('SELECT login_attempts, locked_until FROM users WHERE id = ?', [userId]);
  if (!user) return { locked: false };

  const now = new Date().toISOString().replace('T', ' ').split('.')[0];
  const until = user.locked_until;

  if (until && until > now) {
    const remaining = Math.ceil((new Date(until + 'Z') - new Date()) / 60000);
    return { locked: true, locked_until: until, remaining_minutes: remaining };
  }

  if (until) {
    await run("UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = ?", [userId]);
  }

  return { locked: false, attempts: user.login_attempts || 0 };
}

async function resetFailedLogin(userId) {
  await run("UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = ?", [userId]);
}

async function getLockedUsers() {
  const now = new Date().toISOString().replace('T', ' ').split('.')[0];

  return await query(`
    SELECT o.user_id, o.lock_level, o.locked_until, u.username, u.role,
           COALESCE(s.first_name, t.first_name, '') as first_name,
           COALESCE(s.last_name, t.last_name, '') as last_name,
           'otp' as lock_source
    FROM otp_lockouts o
    JOIN users u ON o.user_id = u.id
    LEFT JOIN students s ON u.id = s.user_id
    LEFT JOIN teachers t ON u.id = t.user_id
    WHERE o.lock_level > 0

    UNION ALL

    SELECT u.id as user_id, 1 as lock_level, u.locked_until, u.username, u.role,
           COALESCE(s.first_name, t.first_name, '') as first_name,
           COALESCE(s.last_name, t.last_name, '') as last_name,
           'login' as lock_source
    FROM users u
    LEFT JOIN students s ON u.id = s.user_id
    LEFT JOIN teachers t ON u.id = t.user_id
    WHERE u.locked_until IS NOT NULL AND u.locked_until > ?

    ORDER BY locked_until DESC
  `, [now]);
}

async function adminUnlockAccount(userId) {
  await run('DELETE FROM otp_lockouts WHERE user_id = ?', [userId]);
  await run("UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = ?", [userId]);
}

async function getSchoolSettings() {
  const keys = ['school_name', 'school_short_name', 'primary_color', 'logo_path'];
  const settings = { school_name: 'SIMS', school_short_name: 'SIMS', primary_color: '#3b82f6', logo_path: null };
  for (const key of keys) {
    const row = await get('SELECT value FROM settings WHERE key = ?', [key]);
    if (row) settings[key] = row.value;
  }
  return settings;
}

async function updateSchoolSetting(key, value) {
  if (isPostgres) {
    await run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value', [key, value]);
  } else {
    await run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }
}

async function getSchoolSetting(key) {
  const row = await get('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : null;
}

module.exports = {
  generatePasscode, getUserByUsername, getUserByRegNo, getUserById, get, run, createUser, updateUserPassword, resetUserPassword, validatePassword,
  createStudent, createTeacher, getStudentByUserId, getTeacherByUserId, getStudentById, generateRegNo,
  createStudentWithUser, createTeacherWithUser,
  updateTeacherClass,
  getAllClasses, createClass, deleteClass,
  getAllSubjects, createSubject, getClassSubjects, assignClassSubject,
  getAllTeachers, getAllStudents, deleteStudent, deleteTeacher, updateStudent, updateTeacher,
  getGradingSystem, addGrade, deleteGrade, calculateGrade,
  getResultsForTeacher, getPendingResults, getAllResults, upsertResult, approveResult, rejectResult,
  getStudentsByClassId, upsertAttendance, getAttendanceByTeacher, getStudentAttendance, getAllAttendance,
  getStudentResults, getPendingResultCount,
  getTeacherAssignedSubjects, getStudentSubjects, getClassSubjectById, getTodayAttendanceForClass, getAttendanceDatesForClass, getAttendanceForDate,
  query, seedDefaultData,
  getCurrentSession, getCurrentTerm, getAllSessions, createSession, deleteSession, setActiveSession,
  getTermsBySession, createTerm, deleteTerm, setActiveTerm,
  promoteStudents,
  updateStudentEmail, getStudentsWithoutEmail,
  getEmailSetting, setEmailSetting,
  sendResultApprovalEmail, sendResultEditEmail, sendAttendanceNotification, sendNewsletter, sendResultPdfEmail, verifyCode,
  getUserWithEmail, getUserWithEmailByRegNo, createPasswordReset, getValidOTP, markOTPUsed,
  checkOTPLockout, recordFailedOTPAttempt, resetOTPLockout, getLockedUsers, adminUnlockAccount,
  recordFailedLogin, checkLoginLocked, resetFailedLogin,
  getSchoolSettings, updateSchoolSetting, getSchoolSetting,
};
