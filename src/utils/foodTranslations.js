// Maps common food names from DA/DE/FR/ES to English for Spoonacular API lookups.
// Keys are lowercase. Add more as users report missing items.

const translations = {
  // Danish
  'kylling': 'chicken', 'kyllingebryst': 'chicken breast', 'kyllingelår': 'chicken thigh',
  'oksekød': 'beef', 'hakket oksekød': 'ground beef', 'bøf': 'steak',
  'svinekød': 'pork', 'flæskesteg': 'pork roast', 'bacon': 'bacon',
  'laks': 'salmon', 'torsk': 'cod', 'rejer': 'shrimp', 'fisk': 'fish', 'tun': 'tuna',
  'brød': 'bread', 'ris': 'rice', 'pasta': 'pasta', 'nudler': 'noodles',
  'mælk': 'milk', 'smør': 'butter', 'ost': 'cheese', 'fløde': 'cream',
  'æg': 'eggs', 'mel': 'flour', 'sukker': 'sugar', 'salt': 'salt',
  'kartofler': 'potatoes', 'kartoffel': 'potato', 'gulerødder': 'carrots', 'gulerod': 'carrot',
  'løg': 'onion', 'hvidløg': 'garlic', 'tomat': 'tomato', 'tomater': 'tomatoes',
  'agurk': 'cucumber', 'salat': 'lettuce', 'spinat': 'spinach',
  'broccoli': 'broccoli', 'blomkål': 'cauliflower', 'ærter': 'peas',
  'bønner': 'beans', 'majs': 'corn', 'peberfrugt': 'bell pepper',
  'champignon': 'mushroom', 'champignoner': 'mushrooms',
  'æble': 'apple', 'æbler': 'apples', 'banan': 'banana', 'bananer': 'bananas',
  'jordbær': 'strawberries', 'hindbær': 'raspberries', 'blåbær': 'blueberries',
  'is': 'ice cream', 'pizza': 'pizza', 'pommes frites': 'french fries', 'fritter': 'fries',
  'pølse': 'sausage', 'pølser': 'sausages', 'skinke': 'ham',
  'lam': 'lamb', 'lammekød': 'lamb', 'and': 'duck', 'kalkun': 'turkey',
  'leverpostej': 'liver pate', 'frikadeller': 'meatballs',
  'grøntsager': 'vegetables', 'frugt': 'fruit',
  'flødeis': 'ice cream', 'franskbrød': 'white bread', 'rugbrød': 'rye bread',
  'pandekager': 'pancakes', 'vafler': 'waffles',
  'suppe': 'soup', 'sovs': 'sauce', 'dej': 'dough', 'butterdej': 'puff pastry',
  'tærtedej': 'pie crust', 'lasagneplader': 'lasagna sheets',
  'hakket kylling': 'ground chicken', 'kødboller': 'meatballs',
  'fiskefilet': 'fish fillet', 'rødspætte': 'plaice', 'sej': 'pollock',

  // German
  'hähnchen': 'chicken', 'hühnchen': 'chicken', 'hähnchenbrust': 'chicken breast',
  'rindfleisch': 'beef', 'hackfleisch': 'ground beef', 'rindersteak': 'steak',
  'schweinefleisch': 'pork', 'schweinebraten': 'pork roast', 'speck': 'bacon',
  'lachs': 'salmon', 'kabeljau': 'cod', 'garnelen': 'shrimp', 'thunfisch': 'tuna',
  'brot': 'bread', 'reis': 'rice', 'nudeln': 'noodles',
  'milch': 'milk', 'butter': 'butter', 'käse': 'cheese', 'sahne': 'cream',
  'eier': 'eggs', 'ei': 'egg', 'mehl': 'flour', 'zucker': 'sugar', 'salz': 'salt',
  'kartoffeln': 'potatoes', 'kartoffel': 'potato', 'karotten': 'carrots', 'möhren': 'carrots',
  'zwiebel': 'onion', 'zwiebeln': 'onions', 'knoblauch': 'garlic',
  'tomate': 'tomato', 'tomaten': 'tomatoes', 'gurke': 'cucumber',
  'kopfsalat': 'lettuce', 'brokkoli': 'broccoli', 'blumenkohl': 'cauliflower',
  'erbsen': 'peas', 'bohnen': 'beans', 'mais': 'corn', 'paprika': 'bell pepper',
  'pilze': 'mushrooms', 'pilz': 'mushroom',
  'apfel': 'apple', 'äpfel': 'apples', 'banane': 'banana',
  'erdbeeren': 'strawberries', 'himbeeren': 'raspberries', 'heidelbeeren': 'blueberries',
  'eis': 'ice cream', 'pommes': 'french fries',
  'wurst': 'sausage', 'würstchen': 'sausages', 'schinken': 'ham',
  'lamm': 'lamb', 'lammfleisch': 'lamb', 'ente': 'duck', 'truthahn': 'turkey',
  'gemüse': 'vegetables', 'obst': 'fruit',
  'pfannkuchen': 'pancakes', 'waffeln': 'waffles',
  'suppe': 'soup', 'soße': 'sauce', 'teig': 'dough', 'blätterteig': 'puff pastry',
  'fisch': 'fish', 'fischfilet': 'fish fillet', 'fleischbällchen': 'meatballs',

  // French
  'poulet': 'chicken', 'blanc de poulet': 'chicken breast', 'cuisse de poulet': 'chicken thigh',
  'boeuf': 'beef', 'bœuf': 'beef', 'viande hachée': 'ground beef', 'steak': 'steak',
  'porc': 'pork', 'rôti de porc': 'pork roast', 'lard': 'bacon',
  'saumon': 'salmon', 'cabillaud': 'cod', 'morue': 'cod',
  'crevettes': 'shrimp', 'poisson': 'fish', 'thon': 'tuna',
  'pain': 'bread', 'riz': 'rice', 'pâtes': 'pasta',
  'lait': 'milk', 'beurre': 'butter', 'fromage': 'cheese', 'crème': 'cream',
  'oeufs': 'eggs', 'oeuf': 'egg', 'farine': 'flour', 'sucre': 'sugar', 'sel': 'salt',
  'pommes de terre': 'potatoes', 'pomme de terre': 'potato',
  'carottes': 'carrots', 'carotte': 'carrot',
  'oignon': 'onion', 'oignons': 'onions', 'ail': 'garlic',
  'tomate': 'tomato', 'tomates': 'tomatoes', 'concombre': 'cucumber',
  'laitue': 'lettuce', 'épinards': 'spinach', 'epinards': 'spinach',
  'brocoli': 'broccoli', 'chou-fleur': 'cauliflower',
  'petits pois': 'peas', 'haricots': 'beans', 'maïs': 'corn', 'poivron': 'bell pepper',
  'champignons': 'mushrooms', 'champignon': 'mushroom',
  'pomme': 'apple', 'pommes': 'apples', 'banane': 'banana',
  'fraises': 'strawberries', 'framboises': 'raspberries', 'myrtilles': 'blueberries',
  'glace': 'ice cream', 'frites': 'french fries',
  'saucisse': 'sausage', 'saucisses': 'sausages', 'jambon': 'ham',
  'agneau': 'lamb', 'canard': 'duck', 'dinde': 'turkey',
  'légumes': 'vegetables', 'fruits': 'fruit',
  'crêpes': 'pancakes', 'gaufres': 'waffles',
  'soupe': 'soup', 'sauce': 'sauce', 'pâte': 'dough', 'pâte feuilletée': 'puff pastry',
  'filet de poisson': 'fish fillet', 'boulettes': 'meatballs',

  // Spanish
  'pollo': 'chicken', 'pechuga de pollo': 'chicken breast', 'muslo de pollo': 'chicken thigh',
  'carne de res': 'beef', 'carne molida': 'ground beef', 'bistec': 'steak',
  'cerdo': 'pork', 'asado de cerdo': 'pork roast', 'tocino': 'bacon',
  'salmón': 'salmon', 'bacalao': 'cod', 'camarones': 'shrimp',
  'pescado': 'fish', 'atún': 'tuna',
  'pan': 'bread', 'arroz': 'rice', 'fideos': 'noodles',
  'leche': 'milk', 'mantequilla': 'butter', 'queso': 'cheese', 'crema': 'cream',
  'huevos': 'eggs', 'huevo': 'egg', 'harina': 'flour', 'azúcar': 'sugar', 'sal': 'salt',
  'patatas': 'potatoes', 'papas': 'potatoes', 'patata': 'potato',
  'zanahorias': 'carrots', 'zanahoria': 'carrot',
  'cebolla': 'onion', 'cebollas': 'onions', 'ajo': 'garlic',
  'tomate': 'tomato', 'tomates': 'tomatoes', 'pepino': 'cucumber',
  'lechuga': 'lettuce', 'espinacas': 'spinach',
  'brócoli': 'broccoli', 'coliflor': 'cauliflower',
  'guisantes': 'peas', 'frijoles': 'beans', 'judías': 'beans',
  'maíz': 'corn', 'pimiento': 'bell pepper',
  'champiñones': 'mushrooms', 'champiñón': 'mushroom', 'setas': 'mushrooms',
  'manzana': 'apple', 'manzanas': 'apples', 'plátano': 'banana',
  'fresas': 'strawberries', 'frambuesas': 'raspberries', 'arándanos': 'blueberries',
  'helado': 'ice cream', 'papas fritas': 'french fries',
  'salchicha': 'sausage', 'salchichas': 'sausages', 'jamón': 'ham',
  'cordero': 'lamb', 'pato': 'duck', 'pavo': 'turkey',
  'verduras': 'vegetables', 'frutas': 'fruit',
  'panqueques': 'pancakes', 'gofres': 'waffles',
  'sopa': 'soup', 'salsa': 'sauce', 'masa': 'dough', 'hojaldre': 'puff pastry',
  'filete de pescado': 'fish fillet', 'albóndigas': 'meatballs',
};

/**
 * Translate a food name to English for API lookups.
 * Tries exact match first, then partial matches for multi-word names.
 */
export const toEnglish = (name) => {
  const lower = name.toLowerCase().trim();

  // Exact match
  if (translations[lower]) return translations[lower];

  // Try removing common adjectives first then matching
  const stripped = lower
    .replace(/\b(frossen?|frisk|kogt|rå|udbenet|skiveret|hakket|tørret|dåse|røget|stegt|bagt)\b/g, '')
    .replace(/\b(gefroren|frisch|gekocht|roh|geräuchert|geschnitten|gehackt|getrocknet|dose)\b/g, '')
    .replace(/\b(congel[ée]|frais|fra[iî]che|cuit|cru|fum[ée]|tranch[ée]|hach[ée]|s[ée]ch[ée])\b/g, '')
    .replace(/\b(congelado|fresco|cocido|crudo|ahumado|cortado|picado|seco|enlatado)\b/g, '')
    .trim()
    .replace(/\s+/g, ' ');

  if (stripped && translations[stripped]) return translations[stripped];

  // No translation found — return original (works fine if already English)
  return lower;
};
