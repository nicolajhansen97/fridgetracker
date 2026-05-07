// Auto-categorize food items by name. Keys are lowercase.
// Supports EN, DA, DE, FR, ES. Returns category key for i18n lookup.

const categoryMap = {
  // Meat / Kød / Fleisch / Viande / Carne
  meat: [
    'chicken', 'beef', 'pork', 'lamb', 'turkey', 'duck', 'steak', 'bacon', 'ham', 'sausage',
    'meatball', 'ground beef', 'ground chicken', 'ground turkey', 'ribs', 'wing', 'thigh', 'breast',
    'salami', 'pepperoni',
    // DA
    'kylling', 'oksekød', 'svinekød', 'lam', 'kalkun', 'and', 'bøf', 'skinke', 'pølse',
    'frikadeller', 'kødboller', 'hakket', 'flæsk', 'bacon', 'leverpostej', 'medister',
    'kyllingebryst', 'kyllingelår', 'nakkefilet', 'koteletter', 'spegepølse',
    // DE
    'hähnchen', 'hühnchen', 'rindfleisch', 'schweinefleisch', 'hackfleisch', 'wurst',
    'schinken', 'speck', 'ente', 'truthahn', 'fleischbällchen', 'hähnchenbrust', 'bratwurst',
    // FR
    'poulet', 'boeuf', 'bœuf', 'porc', 'agneau', 'canard', 'dinde', 'jambon', 'saucisse',
    'lard', 'boulettes', 'viande', 'blanc de poulet', 'cuisse',
    // ES
    'pollo', 'carne', 'cerdo', 'cordero', 'pavo', 'pato', 'tocino', 'salchicha',
    'jamón', 'albóndigas', 'bistec', 'pechuga', 'muslo', 'chuleta',
  ],

  // Fish & Seafood / Fisk / Fisch / Poisson / Pescado
  fish: [
    'fish', 'salmon', 'cod', 'tuna', 'shrimp', 'prawn', 'crab', 'lobster', 'mussel',
    'fillet', 'plaice', 'pollock', 'herring', 'mackerel', 'trout', 'squid',
    // DA
    'fisk', 'laks', 'torsk', 'tun', 'rejer', 'rødspætte', 'sej', 'sild', 'makrel',
    'fiskefilet', 'ørred', 'krabbe', 'hummer', 'blæksprutte',
    // DE
    'lachs', 'kabeljau', 'thunfisch', 'garnelen', 'fischfilet', 'forelle', 'hering', 'makrele',
    // FR
    'saumon', 'cabillaud', 'morue', 'thon', 'crevettes', 'poisson', 'truite', 'hareng',
    'filet de poisson', 'maquereau',
    // ES
    'salmón', 'bacalao', 'atún', 'camarones', 'pescado', 'trucha', 'merluza', 'gambas',
  ],

  // Dairy / Mejeri / Milch / Laitier / Lácteos
  dairy: [
    'milk', 'cheese', 'butter', 'cream', 'yogurt', 'yoghurt', 'egg', 'eggs',
    'mozzarella', 'parmesan', 'cheddar', 'sour cream', 'cottage cheese', 'whipped cream',
    // DA
    'mælk', 'ost', 'smør', 'fløde', 'yoghurt', 'æg', 'skyr', 'piskefløde', 'creme fraiche',
    // DE
    'milch', 'käse', 'butter', 'sahne', 'joghurt', 'ei', 'eier', 'quark', 'schmand', 'schlagsahne',
    // FR
    'lait', 'fromage', 'beurre', 'crème', 'yaourt', 'oeuf', 'oeufs', 'crème fraîche',
    // ES
    'leche', 'queso', 'mantequilla', 'crema', 'yogur', 'huevo', 'huevos', 'nata',
  ],

  // Fruits / Frugt / Obst / Fruits / Frutas
  fruit: [
    'apple', 'banana', 'orange', 'strawberry', 'blueberry', 'raspberry', 'grape', 'mango',
    'pineapple', 'watermelon', 'melon', 'peach', 'pear', 'cherry', 'lemon', 'lime', 'kiwi',
    'avocado', 'plum', 'berry', 'berries', 'fruit',
    // DA
    'æble', 'æbler', 'banan', 'bananer', 'appelsin', 'jordbær', 'blåbær', 'hindbær',
    'vindrue', 'mango', 'ananas', 'vandmelon', 'fersken', 'pære', 'kirsebær', 'citron',
    'frugt', 'bær', 'blomme',
    // DE
    'apfel', 'äpfel', 'banane', 'orange', 'erdbeeren', 'heidelbeeren', 'himbeeren',
    'trauben', 'ananas', 'wassermelone', 'pfirsich', 'birne', 'kirsche', 'zitrone', 'obst', 'pflaume',
    // FR
    'pomme', 'pommes', 'banane', 'fraises', 'myrtilles', 'framboises', 'raisin',
    'ananas', 'pastèque', 'pêche', 'poire', 'cerise', 'citron', 'fruits', 'prune',
    // ES
    'manzana', 'manzanas', 'plátano', 'naranja', 'fresas', 'arándanos', 'frambuesas',
    'uvas', 'piña', 'sandía', 'melocotón', 'pera', 'cereza', 'limón', 'frutas', 'ciruela',
  ],

  // Vegetables / Grøntsager / Gemüse / Légumes / Verduras
  vegetables: [
    'potato', 'potatoes', 'carrot', 'carrots', 'onion', 'garlic', 'tomato', 'tomatoes',
    'cucumber', 'lettuce', 'spinach', 'broccoli', 'cauliflower', 'peas', 'beans', 'corn',
    'pepper', 'bell pepper', 'mushroom', 'mushrooms', 'cabbage', 'celery', 'zucchini',
    'eggplant', 'asparagus', 'leek', 'radish', 'beetroot', 'sweet potato', 'vegetables',
    // DA
    'kartoffel', 'kartofler', 'gulerod', 'gulerødder', 'løg', 'hvidløg', 'tomat', 'tomater',
    'agurk', 'salat', 'spinat', 'broccoli', 'blomkål', 'ærter', 'bønner', 'majs',
    'peberfrugt', 'champignon', 'champignoner', 'kål', 'selleri', 'squash',
    'aubergine', 'asparges', 'porre', 'radise', 'rødbede', 'grøntsager', 'sødkartoffel',
    // DE
    'kartoffel', 'kartoffeln', 'karotte', 'karotten', 'möhren', 'zwiebel', 'knoblauch',
    'tomate', 'tomaten', 'gurke', 'kopfsalat', 'spinat', 'brokkoli', 'blumenkohl',
    'erbsen', 'bohnen', 'mais', 'paprika', 'pilz', 'pilze', 'kohl', 'sellerie',
    'zucchini', 'aubergine', 'spargel', 'lauch', 'gemüse', 'süßkartoffel',
    // FR
    'pomme de terre', 'pommes de terre', 'carotte', 'carottes', 'oignon', 'ail',
    'tomate', 'tomates', 'concombre', 'laitue', 'épinards', 'brocoli', 'chou-fleur',
    'petits pois', 'haricots', 'maïs', 'poivron', 'champignon', 'champignons',
    'chou', 'céleri', 'courgette', 'aubergine', 'asperges', 'poireau', 'légumes',
    // ES
    'patata', 'patatas', 'papas', 'zanahoria', 'zanahorias', 'cebolla', 'ajo',
    'tomate', 'tomates', 'pepino', 'lechuga', 'espinacas', 'brócoli', 'coliflor',
    'guisantes', 'frijoles', 'judías', 'maíz', 'pimiento', 'champiñón', 'champiñones',
    'setas', 'col', 'apio', 'calabacín', 'berenjena', 'espárragos', 'puerro', 'verduras',
  ],

  // Bread & Bakery / Brød / Brot / Pain / Pan
  bread: [
    'bread', 'toast', 'bun', 'roll', 'bagel', 'croissant', 'tortilla', 'pita',
    'pancake', 'waffle', 'pie crust', 'puff pastry', 'dough', 'pizza dough',
    // DA
    'brød', 'franskbrød', 'rugbrød', 'bolle', 'pandekager', 'vafler', 'dej',
    'butterdej', 'tærtedej', 'pizzadej', 'toast', 'ciabatta', 'flutes',
    // DE
    'brot', 'brötchen', 'toast', 'pfannkuchen', 'waffeln', 'teig', 'blätterteig',
    'croissant', 'semmel',
    // FR
    'pain', 'baguette', 'croissant', 'crêpes', 'gaufres', 'pâte', 'pâte feuilletée',
    'brioche', 'tortilla',
    // ES
    'pan', 'tostada', 'tortilla', 'panqueques', 'gofres', 'masa', 'hojaldre',
    'bollo', 'croissant',
  ],

  // Frozen meals & Ready-made / Færdigretter / Fertiggerichte
  frozen: [
    'pizza', 'lasagna', 'lasagne', 'nugget', 'nuggets', 'fish stick', 'fish finger',
    'french fries', 'fries', 'ice cream', 'frozen meal', 'burrito', 'spring roll',
    // DA
    'pizza', 'lasagne', 'nuggets', 'fiskepinde', 'pommes frites', 'fritter', 'is',
    'flødeis', 'forårsruller', 'færdigret', 'lasagneplader',
    // DE
    'pizza', 'lasagne', 'nuggets', 'fischstäbchen', 'pommes', 'eis', 'tiefkühlgericht',
    'frühlingsrollen',
    // FR
    'pizza', 'lasagne', 'nuggets', 'bâtonnets de poisson', 'frites', 'glace',
    'plat surgelé', 'nems',
    // ES
    'pizza', 'lasaña', 'nuggets', 'palitos de pescado', 'papas fritas', 'helado',
    'comida congelada', 'rollitos',
  ],

  // Pantry / Kolonial / Vorrat / Épicerie / Despensa
  pantry: [
    'rice', 'pasta', 'noodles', 'flour', 'sugar', 'salt', 'oil', 'vinegar',
    'sauce', 'soup', 'ketchup', 'mustard', 'soy sauce', 'honey', 'jam',
    'cereal', 'oats', 'nuts', 'peanut butter', 'chocolate', 'coffee', 'tea',
    // DA
    'ris', 'pasta', 'nudler', 'mel', 'sukker', 'salt', 'olie', 'eddike',
    'sovs', 'suppe', 'ketchup', 'sennep', 'soja', 'honning', 'syltetøj',
    'havregryn', 'nødder', 'chokolade', 'kaffe', 'te',
    // DE
    'reis', 'nudeln', 'mehl', 'zucker', 'salz', 'öl', 'essig',
    'soße', 'suppe', 'senf', 'honig', 'marmelade', 'haferflocken',
    'nüsse', 'schokolade', 'kaffee', 'tee',
    // FR
    'riz', 'pâtes', 'farine', 'sucre', 'sel', 'huile', 'vinaigre',
    'sauce', 'soupe', 'moutarde', 'miel', 'confiture', 'céréales',
    'flocons', 'noix', 'chocolat', 'café', 'thé',
    // ES
    'arroz', 'fideos', 'harina', 'azúcar', 'sal', 'aceite', 'vinagre',
    'salsa', 'sopa', 'mostaza', 'miel', 'mermelada', 'cereales',
    'avena', 'nueces', 'chocolate', 'café', 'té',
  ],

  // Drinks / Drikkevarer / Getränke / Boissons / Bebidas
  drinks: [
    'water', 'juice', 'soda', 'beer', 'wine', 'milk', 'cola', 'lemonade',
    'smoothie', 'energy drink',
    // DA
    'vand', 'juice', 'sodavand', 'øl', 'vin', 'cola', 'limonade', 'smoothie',
    // DE
    'wasser', 'saft', 'limonade', 'bier', 'wein', 'cola', 'smoothie',
    // FR
    'eau', 'jus', 'soda', 'bière', 'vin', 'limonade', 'smoothie',
    // ES
    'agua', 'zumo', 'jugo', 'refresco', 'cerveza', 'vino', 'limonada', 'smoothie',
  ],
};

// Build a lookup: word → category
const wordToCategory = new Map();
Object.entries(categoryMap).forEach(([category, words]) => {
  words.forEach((word) => wordToCategory.set(word.toLowerCase(), category));
});

/**
 * Returns a category key for a food item name.
 * Tries exact match, then checks if any keyword is contained in the name.
 */
export const getCategory = (name) => {
  const lower = name.toLowerCase().trim();

  // Exact match
  if (wordToCategory.has(lower)) return wordToCategory.get(lower);

  // Check if name contains a known keyword (longest match first)
  let best = null;
  let bestLen = 0;
  for (const [word, cat] of wordToCategory) {
    if (word.length > bestLen && lower.includes(word)) {
      best = cat;
      bestLen = word.length;
    }
  }

  return best || 'other';
};

// All category keys for UI ordering
export const CATEGORY_ORDER = [
  'fruit', 'vegetables', 'meat', 'fish', 'dairy', 'bread', 'frozen', 'pantry', 'drinks', 'other',
];
