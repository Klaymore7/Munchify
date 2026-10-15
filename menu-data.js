// menu-data.js



window.MUNCHIFY_CATALOG = [
    {
        id: 'farm-city',
        name: 'Farm City',
        image: './images/imgi_99_Farmcity-Shutdown-Platter-450x450.jpg',
        rating: 4.8,
        etaMinutes: 25,
        deliveryFee: 800,
        cuisine: 'Grill, rice, bowls',
        items: [
            { id: 'farm-jollof', name: 'Smoky Jollof & Chicken', description: 'Party jollof, grilled chicken, and fresh slaw.', category: 'Rice', price: 4900, image: './images/imgi_99_Farmcity-Shutdown-Platter-450x450.jpg' },
            { id: 'farm-beef-bowl', name: 'Suya Beef Rice Bowl', description: 'Spiced beef suya over seasoned rice.', category: 'Meats', price: 5700, image: './images/imgi_110_G-Burger-By-Galaxy-Abuja-2.jpg' },
            { id: 'farm-plantain', name: 'Chicken & Plantain Combo', description: 'Grilled chicken with sweet fried plantain.', category: 'Meats', price: 4200, image: './images/imgi_99_Farmcity-Shutdown-Platter-450x450.jpg' }
        ]
    },
    {
        id: 'ibro-fish',
        name: 'Ibro Fish',
        image: './images/imgi_120_ibro-fish-wuse-2-4-8020104.jpg',
        rating: 4.9,
        etaMinutes: 30,
        deliveryFee: 1000,
        cuisine: 'Seafood, grills',
        items: [
            { id: 'ibro-platter', name: 'Ibro Fish Platter', description: 'Fresh grilled fish with pepper sauce and sides.', category: 'Seafood', price: 6500, image: './images/imgi_120_ibro-fish-wuse-2-4-8020104.jpg' },
            { id: 'ibro-croaker', name: 'Grilled Croaker', description: 'Whole croaker grilled with house spices.', category: 'Seafood', price: 8900, image: './images/imgi_126_ibro-fish-wuse-2-2-8020102.jpg' },
            { id: 'ibro-pepper-soup', name: 'Fish Pepper Soup', description: 'Hot, aromatic broth with fresh fish.', category: 'Seafood', price: 5200, image: './images/imgi_120_ibro-fish-wuse-2-4-8020104.jpg' }
        ]
    },
    {
        id: 'ahmads-shawarma',
        name: "Ahmad's Shawarma",
        image: './images/imgi_28_images.jpg',
        rating: 4.7,
        etaMinutes: 18,
        deliveryFee: 600,
        cuisine: 'Wraps, fries, drinks',
        items: [
            { id: 'ahmad-chicken-wrap', name: 'Chicken Shawarma', description: 'Chicken, crunchy vegetables, and garlic sauce.', category: 'Wraps', price: 2900, image: './images/imgi_28_images.jpg' },
            { id: 'ahmad-beef-wrap', name: 'Beef Shawarma', description: 'Spiced beef with fresh vegetables and house sauce.', category: 'Wraps', price: 3500, image: './images/imgi_28_images.jpg' },
            { id: 'ahmad-loaded-fries', name: 'Loaded Shawarma Fries', description: 'Golden fries topped with shawarma and sauce.', category: 'Meats', price: 4200, image: './images/imgi_28_images.jpg' }
        ]
    },
    {
        id: 'downtown-takeaway',
        name: 'Downtown Takeaway',
        image: './images/imgi_145_108122791_1011769305937660_6505898727259829378_n-1200x900.jpg',
        rating: 4.6,
        etaMinutes: 20,
        deliveryFee: 700,
        cuisine: 'Fast food, burgers',
        items: [
            { id: 'downtown-crunch-burger', name: 'Crunch Burger', description: 'Crispy chicken burger with pickles and fries.', category: 'Burgers', price: 3900, image: './images/imgi_121_Burger.png' },
            { id: 'downtown-jollof', name: 'Jollof Chicken Bowl', description: 'Jollof rice with grilled chicken and slaw.', category: 'Rice', price: 4800, image: './images/imgi_145_108122791_1011769305937660_6505898727259829378_n-1200x900.jpg' },
            { id: 'downtown-veggie-wrap', name: 'Fresh Veggie Wrap', description: 'Seasonal vegetables with a creamy house dressing.', category: 'Wraps', price: 3200, image: './images/imgi_145_108122791_1011769305937660_6505898727259829378_n-1200x900.jpg' }
        ]
    },
    {
        id: 'chicken-republic',
        name: 'Chicken Republic',
        image: './images/imgi_132_zmvinsmglijvon0cdsq4.jpg',
        rating: 'New',
        etaMinutes: 30,
        deliveryFee: 800,
        zone: 'Wuse',
        cuisine: 'Chicken, rice, pastries',
        items: [
            { id: 'cr_wuse_01', name: 'Refuel Max Meal', description: 'Spicy fried chicken with jollof rice and a cold drink.', category: 'Rice', price: 4200, image: './images/imgi_132_zmvinsmglijvon0cdsq4.jpg', available: true },
            { id: 'cr_wuse_02', name: 'Citizen Meal Combo', description: 'Crunchy chicken with your choice of sides and pepper sauce.', category: 'Rice', price: 3500, image: './images/imgi_96_Farm-City-Platter.png', available: true },
            { id: 'cr_wuse_03', name: 'Crunchy Chicken Pie', description: 'Golden pastry filled with seasoned chicken and vegetables.', category: 'Pastries', price: 1200, image: './images/imgi_132_zmvinsmglijvon0cdsq4.jpg', available: false }
        ]
    },
    {
        id: 'kilimanjaro',
        name: 'Kilimanjaro',
        image: './images/imgi_94_Village-Chief-Swallow-Abuja-1.jpg',
        rating: 'New',
        etaMinutes: 35,
        deliveryFee: 900,
        zone: 'Gwarinpa',
        cuisine: 'Swallows, rice, grills',
        items: [
            { id: 'kili_gwarinpa_01', name: 'Catfish Swallow Combo', description: 'Spicy catfish soup paired with smooth pounded yam.', category: 'Swallows', price: 5800, image: './images/imgi_94_Village-Chief-Swallow-Abuja-1.jpg', available: true },
            { id: 'kili_gwarinpa_02', name: 'Smoked Suya Fried Rice', description: 'Fried rice tossed with shredded beef suya and cabbage.', category: 'Rice', price: 4800, image: './images/imgi_96_Farm-City-Platter.png', available: true }
        ]
    },
    {
        id: 'charcoal-grill',
        name: 'Charcoal Grill',
        image: './images/imgi_96_Farm-City-Platter.png',
        rating: 'New',
        etaMinutes: 40,
        deliveryFee: 1000,
        zone: 'Maitama',
        cuisine: 'Charcoal grills',
        items: [
            { id: 'cg_maitama_01', name: 'Grilled Croaker Fish Sizzler', description: 'Whole croaker grilled over charcoal with a rich spicy glaze.', category: 'Grills', price: 12000, image: './images/imgi_120_ibro-fish-wuse-2-4-8020104.jpg', available: true }
        ]
    }
];
