// This is browser-only demo authentication. It stores account records locally and
// must be replaced with server authentication before handling real user accounts.
(() => {
    const accountsKey = 'munchifyAccounts';
    const persistentSessionKey = 'munchifyAuthSession';
    const tabSessionKey = 'munchifyTabSession';
    const cartKey = 'munchifyCart';
    const ordersKey = 'munchifyOrders';
    const inventoryKey = 'munchifyVendorInventory';
    const restaurantsKey = 'munchifyVendorRestaurants';
    const availabilityKey = 'munchifyMenuAvailability';
    const ridersKey = 'munchifyRiders';
    const passwordIterations = 120000;

    const formatMoney = (amount) => `₦${Number(amount || 0).toLocaleString('en-NG')}`;

    function readList(key) {
        try {
            const value = JSON.parse(localStorage.getItem(key) || '[]');
            return Array.isArray(value) ? value : [];
        } catch {
            return [];
        }
    }

    function saveList(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function readObject(key) {
        try {
            const value = JSON.parse(localStorage.getItem(key) || '{}');
            return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
        } catch {
            return {};
        }
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (character) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[character]);
    }

    function getCatalog() {
        const vendorItems = readList(inventoryKey);
        const availability = readObject(availabilityKey);
        const restaurants = [...(window.MUNCHIFY_CATALOG || []), ...readList(restaurantsKey)];
        return restaurants.map((restaurant) => ({
            ...restaurant,
            items: [
                ...restaurant.items.map((item) => ({ ...item, available: item.available !== false && availability[item.id] !== false })),
                ...vendorItems.filter((item) => item.restaurantId === restaurant.id).map((item) => ({ ...item, available: item.available !== false }))
            ]
        }));
    }

    function updateStoredOrder(orderId, update) {
        const orders = readList(ordersKey);
        const order = orders.find((item) => item.id === orderId);
        if (!order) return false;
        update(order);
        saveList(ordersKey, orders);
        return true;
    }

    function addOrderEvent(order, status, note) {
        const at = Date.now();
        order.status = status;
        order.updatedAt = at;
        order.events = [...(order.events || []), { status, at, note }];
    }

    function getCart() {
        try {
            return JSON.parse(localStorage.getItem(cartKey) || '{"restaurantId":"","items":[]}');
        } catch {
            return { restaurantId: '', items: [] };
        }
    }

    function getCartLines(cart = getCart()) {
        const restaurant = getCatalog().find((item) => item.id === cart.restaurantId);
        if (!restaurant) return { restaurant: null, lines: [] };
        const lines = cart.items.map((cartItem) => {
            const item = restaurant.items.find((menuItem) => menuItem.id === cartItem.itemId);
            return item ? { ...item, quantity: cartItem.quantity } : null;
        }).filter(Boolean);
        return { restaurant, lines };
    }

    function cartSubtotal(lines) {
        return lines.reduce((sum, item) => sum + item.price * item.quantity, 0);
    }

    function updateCartBadge() {
        const count = getCart().items.reduce((sum, item) => sum + item.quantity, 0);
        const badge = document.querySelector('#cart-count');
        if (badge) badge.textContent = String(count);
    }

    function updateTrackLink() {
        const link = document.querySelector('#track-order-link');
        if (!link) return;
        const session = getCurrentSession();
        const latestOrder = readList(ordersKey)
            .filter((order) => !session || order.customerUsername === session.username)
            .sort((first, second) => second.createdAt - first.createdAt)[0];
        link.href = latestOrder ? `track-order.html?order=${encodeURIComponent(latestOrder.id)}` : 'track-order.html';
    }

    function loadAccounts() {
        try {
            const accounts = JSON.parse(localStorage.getItem(accountsKey) || '[]');
            return Array.isArray(accounts) ? accounts : [];
        } catch {
            return [];
        }
    }

    async function ensureDemoVendorAccounts() {
        const accounts = loadAccounts();
        const catalog = window.MUNCHIFY_CATALOG || [];
        let changed = false;

        // Match older vendor registrations to a catalog restaurant when their names agree.
        accounts.forEach((account) => {
            if (account.role !== 'restaurant' || account.restaurantId) return;
            const normalizedName = account.displayName.toLowerCase().replace(/[^a-z0-9]/g, '');
            const restaurant = catalog.find((item) => item.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedName);
            if (restaurant) {
                account.restaurantId = restaurant.id;
                changed = true;
            }
        });

        const demoSpecs = [
            { restaurantId: 'farm-city', username: 'demo-farm-city', password: 'FarmCityDemo2026!' },
            { restaurantId: 'ibro-fish', username: 'demo-ibro-fish', password: 'IbroFishDemo2026!' },
            { restaurantId: 'ahmads-shawarma', username: 'demo-ahmads-shawarma', password: 'AhmadsDemo2026!' },
            { restaurantId: 'downtown-takeaway', username: 'demo-downtown', password: 'DowntownDemo2026!' },
            { restaurantId: 'chicken-republic', username: 'demo-chicken-republic', password: 'ChickenRepublic2026!' },
            { restaurantId: 'kilimanjaro', username: 'demo-kilimanjaro', password: 'Kilimanjaro2026!' },
            { restaurantId: 'charcoal-grill', username: 'demo-charcoal-grill', password: 'CharcoalGrill2026!' }
        ];
        const demoLogins = [];

        for (const spec of demoSpecs) {
            const restaurant = catalog.find((item) => item.id === spec.restaurantId);
            if (!restaurant) continue;
            let account = accounts.find((item) => item.demoVendor && item.restaurantId === restaurant.id);

            if (!account) {
                let username = spec.username;
                let suffix = 1;
                while (accounts.some((item) => item.username === username)) {
                    username = `${spec.username}-${suffix}`;
                    suffix += 1;
                }
                const salt = window.crypto.getRandomValues(new Uint8Array(16));
                account = {
                    username,
                    displayName: restaurant.name,
                    phone: '',
                    role: 'restaurant',
                    restaurantId: restaurant.id,
                    zone: restaurant.zone || 'wuse',
                    demoVendor: true,
                    salt: bytesToHex(salt),
                    passwordHash: await hashPassword(spec.password, salt)
                };
                accounts.push(account);
                changed = true;
            }

            demoLogins.push({
                restaurantName: restaurant.name,
                username: account.username,
                password: spec.password
            });
        }

        if (changed) localStorage.setItem(accountsKey, JSON.stringify(accounts));
        return demoLogins;
    }

    function readSession(storage, key) {
        try {
            return JSON.parse(storage.getItem(key) || 'null');
        } catch {
            return null;
        }
    }

    function getCurrentSession() {
        const session = readSession(localStorage, persistentSessionKey) || readSession(sessionStorage, tabSessionKey);
        if (session?.role === 'restaurant' && !session.restaurantId) {
            const account = loadAccounts().find((item) => item.username === session.username);
            if (account?.restaurantId) session.restaurantId = account.restaurantId;
        }
        return session;
    }

    function saveAuthSession(account, rememberMe) {
        const session = JSON.stringify({
            username: account.username,
            displayName: account.displayName,
            role: account.role,
            restaurantId: account.restaurantId || null
        });
        localStorage.removeItem(persistentSessionKey);
        sessionStorage.removeItem(tabSessionKey);
        (rememberMe ? localStorage : sessionStorage).setItem(
            rememberMe ? persistentSessionKey : tabSessionKey,
            session
        );
    }

    function clearAuthSession() {
        localStorage.removeItem(persistentSessionKey);
        sessionStorage.removeItem(tabSessionKey);
    }

    function bytesToHex(bytes) {
        return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    }

    function hexToBytes(hex) {
        return new Uint8Array(hex.match(/.{2}/g).map((byte) => parseInt(byte, 16)));
    }

    // PBKDF2 makes stored password verifiers harder to crack than plain-text passwords.
    async function hashPassword(password, salt) {
        const key = await window.crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(password),
            'PBKDF2',
            false,
            ['deriveBits']
        );
        const bits = await window.crypto.subtle.deriveBits({
            name: 'PBKDF2',
            salt,
            iterations: passwordIterations,
            hash: 'SHA-256'
        }, key, 256);
        return bytesToHex(new Uint8Array(bits));
    }

    function hashesMatch(first, second) {
        if (first.length !== second.length) return false;
        let difference = 0;
        for (let index = 0; index < first.length; index += 1) {
            difference |= first.charCodeAt(index) ^ second.charCodeAt(index);
        }
        return difference === 0;
    }

    function openRoleHome(role) {
        // Customer accounts return to the storefront; restaurant accounts open the vendor tools.
        if (role === 'restaurant') {
            window.location.assign('dashboard.html');
            return;
        }
        const returnTo = new URLSearchParams(window.location.search).get('return');
        window.location.assign(returnTo === 'checkout.html' ? 'checkout.html' : 'index.html#restaurants');
    }

    function setupAuthForms() {
        const loginForm = document.querySelector('#login-form');
        const registrationForm = document.querySelector('#registration-form');
        if (!loginForm || !registrationForm) return;

        const loginPanel = loginForm.closest('.wrapper');
        const registrationPanel = registrationForm.closest('.wrapper');
        const vendorRole = document.querySelector('#restaurant-role');
        const displayNameField = document.querySelector('#display-name-field');
        const displayNameInput = registrationForm.elements['display-name'];
        const vendorRestaurantField = document.querySelector('#vendor-restaurant-field');
        const authStatus = document.querySelector('#auth-status');
        const demoAccountsContainer = document.querySelector('#vendor-demo-accounts');
        const demoLoginsPromise = ensureDemoVendorAccounts().catch(() => []);

        demoLoginsPromise.then((demoLogins) => {
            demoAccountsContainer.innerHTML = demoLogins.map((demo) => `<button type="button" class="vendor-demo-account" data-demo-username="${escapeHtml(demo.username)}" data-demo-password="${escapeHtml(demo.password)}">
                <strong>${escapeHtml(demo.restaurantName)}</strong>
                <span>${escapeHtml(demo.username)}</span>
                <small>Password: ${escapeHtml(demo.password)} · Use account</small>
            </button>`).join('');
        });

        demoAccountsContainer.addEventListener('click', (event) => {
            const button = event.target.closest('[data-demo-username]');
            if (!button) return;
            loginForm.elements.username.value = button.dataset.demoUsername;
            loginForm.elements.password.value = button.dataset.demoPassword;
            document.querySelector('#login-restaurant-role').checked = true;
            loginForm.elements.remember.checked = false;
        });

        function showForm(view) {
            const showRegistration = view === 'register' || view === 'register-vendor';
            loginPanel.hidden = showRegistration;
            registrationPanel.hidden = !showRegistration;
            if (view === 'register-vendor' && vendorRole) vendorRole.checked = true;
        }

        function updateSignupFields() {
            const isVendor = vendorRole?.checked ?? false;
            vendorRestaurantField.hidden = !isVendor;
            vendorRestaurantField.querySelectorAll('input, select').forEach((field) => {
                field.required = isVendor;
            });
            displayNameField.hidden = isVendor;
            displayNameInput.required = !isVendor;
        }

        function showStatus(message) {
            authStatus.textContent = message;
            authStatus.hidden = false;
        }

        function syncFormFromHash() {
            const view = window.location.hash.slice(1);
            showForm(view.startsWith('register') ? view : 'login');
            updateSignupFields();
        }

        // The URL hash lets links elsewhere open the correct form directly.
        document.querySelectorAll('[data-auth-view]').forEach((link) => {
            link.addEventListener('click', () => showForm(link.dataset.authView));
        });

        window.addEventListener('hashchange', syncFormFromHash);
        syncFormFromHash();
        document.querySelectorAll('input[name="user-role"]').forEach((input) => {
            input.addEventListener('change', updateSignupFields);
        });

        loginForm.addEventListener('submit', (event) => {
            event.preventDefault();
            void (async () => {
                await demoLoginsPromise;
                const username = loginForm.elements.username.value.trim().toLowerCase();
                const password = loginForm.elements.password.value;
                const role = loginForm.elements['login-role'].value;
                const account = loadAccounts().find((item) => item.username === username);

                if (!account || account.role !== role) {
                    showStatus('Username, password, or account type is incorrect.');
                    return;
                }

                try {
                    const attemptedHash = await hashPassword(password, hexToBytes(account.salt));
                    if (!hashesMatch(attemptedHash, account.passwordHash)) {
                        showStatus('Username, password, or account type is incorrect.');
                        return;
                    }
                    saveAuthSession(account, loginForm.elements.remember.checked);
                    openRoleHome(account.role);
                } catch {
                    showStatus('Local sign-in is unavailable in this browser.');
                }
            })();
        });

        registrationForm.addEventListener('submit', (event) => {
            event.preventDefault();
            if (!registrationForm.reportValidity()) return;

            if (registrationForm.elements.password.value !== registrationForm.elements['confirm-password'].value) {
                showStatus('The passwords do not match. Please check both fields.');
                return;
            }

            void (async () => {
                const username = registrationForm.elements.username.value.trim().toLowerCase();
                const role = registrationForm.elements['user-role'].value;
                let restaurant = null;
                if (role === 'restaurant') {
                    const restaurantName = registrationForm.elements['restaurant-name'].value.trim();
                    const normalizedName = restaurantName.toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (getCatalog().some((item) => item.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedName)) {
                        showStatus('A restaurant with that name already exists. Sign in with its vendor account instead.');
                        return;
                    }
                    restaurant = {
                        id: `vendor-${Date.now().toString(36)}`,
                        name: restaurantName,
                        cuisine: registrationForm.elements['restaurant-cuisine'].value.trim(),
                        zone: registrationForm.elements['restaurant-area'].value,
                        etaMinutes: Number(registrationForm.elements['restaurant-eta'].value),
                        deliveryFee: Number(registrationForm.elements['restaurant-delivery-fee'].value),
                        image: './images/imgi_110_G-Burger-By-Galaxy-Abuja-2.jpg',
                        rating: 'New',
                        items: []
                    };
                }
                const accounts = loadAccounts();
                if (accounts.some((account) => account.username === username)) {
                    showStatus('That username is already registered. Try logging in instead.');
                    return;
                }

                try {
                    const salt = window.crypto.getRandomValues(new Uint8Array(16));
                    const account = {
                        username,
                        displayName: restaurant?.name || displayNameInput.value.trim(),
                        phone: registrationForm.elements.phone.value.trim(),
                        role,
                        restaurantId: restaurant?.id || null,
                        zone: restaurant?.zone || '',
                        salt: bytesToHex(salt),
                        passwordHash: await hashPassword(registrationForm.elements.password.value, salt)
                    };
                    if (restaurant) saveList(restaurantsKey, [...readList(restaurantsKey), restaurant]);
                    accounts.push(account);
                    localStorage.setItem(accountsKey, JSON.stringify(accounts));
                    saveAuthSession(account, true);
                    openRoleHome(account.role);
                } catch {
                    showStatus('Could not save this account in local storage.');
                }
            })();
        });
    }

    function setupCustomerPage() {
        const restaurantGrid = document.querySelector('#restaurant-grid');
        const menuDialog = document.querySelector('#menu-dialog');
        const menuItems = document.querySelector('#menu-items');
        const dialogTitle = document.querySelector('#menu-dialog-title');
        const cartFeedback = document.querySelector('#menu-cart-feedback');

        if (restaurantGrid) {
            restaurantGrid.innerHTML = getCatalog().map((restaurant) => {
                const availableItems = restaurant.items.filter((item) => item.available !== false);
                const lowestPrice = availableItems.length ? Math.min(...availableItems.map((item) => item.price)) : 0;
                return `<article class="restaurant-card" data-restaurant-id="${escapeHtml(restaurant.id)}">
                    <img src="${escapeHtml(restaurant.image)}" alt="${escapeHtml(restaurant.name)}">
                    <div class="restaurant-card-body">
                        <div class="restaurant-card-top"><h4>${escapeHtml(restaurant.name)}</h4><span>★ ${escapeHtml(restaurant.rating)}</span></div>
                        <p>${escapeHtml(restaurant.cuisine)}</p>
                        <div class="restaurant-card-bottom"><span>${escapeHtml(restaurant.etaMinutes)} min delivery</span><strong>From ${formatMoney(lowestPrice)}</strong></div>
                        <button type="button" class="restaurant-order-link" data-open-menu="${escapeHtml(restaurant.id)}" ${availableItems.length ? '' : 'disabled'}>${availableItems.length ? 'View menu' : 'Currently unavailable'}</button>
                    </div>
                </article>`;
            }).join('');
        }

        const accountLink = document.querySelector('.customer-account-link');
        const session = getCurrentSession();
        if (accountLink && session?.role === 'customer') {
            accountLink.textContent = `Log out, ${session.displayName}`;
            accountLink.href = '#logout';
            accountLink.addEventListener('click', (event) => {
                event.preventDefault();
                clearAuthSession();
                window.location.reload();
            });
        } else if (accountLink && session?.role === 'restaurant') {
            accountLink.textContent = 'Vendor dashboard';
            accountLink.href = 'dashboard.html';
        }

        if (restaurantGrid && menuDialog && menuItems) {
            restaurantGrid.addEventListener('click', (event) => {
                const menuButton = event.target.closest('[data-open-menu]');
                if (!menuButton) return;
                const restaurant = getCatalog().find((item) => item.id === menuButton.dataset.openMenu);
                if (!restaurant) return;
                dialogTitle.textContent = restaurant.name;
                menuItems.dataset.restaurantId = restaurant.id;
                menuItems.innerHTML = restaurant.items.filter((item) => item.available !== false).map((item) => `<article class="menu-item-card">
                    <img src="${escapeHtml(item.image || restaurant.image)}" alt="">
                    <div class="menu-item-copy"><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description)}</p><span>${escapeHtml(item.category)}</span></div>
                    <div class="menu-item-action"><strong>${formatMoney(item.price)}</strong><button type="button" class="primary-btn" data-add-item="${escapeHtml(item.id)}">Add</button></div>
                </article>`).join('');
                cartFeedback.textContent = '';
                menuDialog.showModal();
            });

            menuItems.addEventListener('click', (event) => {
                const addButton = event.target.closest('[data-add-item]');
                if (!addButton) return;
                const restaurantId = menuItems.dataset.restaurantId;
                const cart = getCart();
                if (cart.items.length && cart.restaurantId !== restaurantId && !window.confirm('Starting a new restaurant order will clear your current cart. Continue?')) return;
                const nextCart = cart.restaurantId === restaurantId ? cart : { restaurantId, items: [] };
                const existing = nextCart.items.find((item) => item.itemId === addButton.dataset.addItem);
                if (existing) existing.quantity += 1;
                else nextCart.items.push({ itemId: addButton.dataset.addItem, quantity: 1 });
                localStorage.setItem(cartKey, JSON.stringify(nextCart));
                updateCartBadge();
                cartFeedback.textContent = 'Added to your cart.';
            });

            menuDialog.querySelector('.menu-dialog-close').addEventListener('click', () => menuDialog.close());
            menuDialog.addEventListener('click', (event) => {
                if (event.target === menuDialog) menuDialog.close();
            });
        }

        const filterButtons = document.querySelectorAll('.category-strip .filter-pill');
        const restaurantCards = () => document.querySelectorAll('#restaurant-grid .restaurant-card');
        const emptyMessage = document.querySelector('.restaurant-empty');
        const restaurantSearch = document.querySelector('#restaurant-search');
        let activeCategory = 'all';

        function applyRestaurantFilters() {
            const query = restaurantSearch?.value.trim().toLowerCase() || '';
            const catalog = getCatalog();
            restaurantCards().forEach((card) => {
                const restaurant = catalog.find((item) => item.id === card.dataset.restaurantId);
                if (!restaurant) return;
                const availableItems = restaurant.items.filter((item) => item.available !== false);
                const matchesCategory = activeCategory === 'all' || availableItems.some((item) => item.category.toLowerCase() === activeCategory);
                const searchableText = [restaurant.name, restaurant.cuisine, restaurant.zone, ...availableItems.flatMap((item) => [item.name, item.description, item.category])].join(' ').toLowerCase();
                card.hidden = !matchesCategory || (query !== '' && !searchableText.includes(query));
            });
            if (emptyMessage) {
                const hasResults = [...restaurantCards()].some((card) => !card.hidden);
                emptyMessage.textContent = query ? `No restaurants or menu items match "${restaurantSearch.value.trim()}".` : `No restaurants match the ${activeCategory} category yet.`;
                emptyMessage.hidden = hasResults;
            }
        }

        filterButtons.forEach((button) => {
            button.addEventListener('click', () => {
                activeCategory = button.textContent.trim().toLowerCase();
                filterButtons.forEach((item) => item.classList.toggle('active', item === button));
                applyRestaurantFilters();
            });
        });
        restaurantSearch?.addEventListener('input', applyRestaurantFilters);
        restaurantSearch?.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            restaurantSearch.value = '';
            applyRestaurantFilters();
        });

        updateCartBadge();
        updateTrackLink();
    }

    function orderStatusLabel(status) {
        return ({
            placed: 'New',
            confirmed: 'Confirmed',
            preparing: 'Preparing',
            'picked-up': 'On the way',
            delivered: 'Delivered',
            cancelled: 'Cancelled'
        })[status] || status;
    }

    function orderStatusClass(status) {
        return ({
            placed: 'pending',
            confirmed: 'accepted',
            preparing: 'preparing',
            'picked-up': 'delivering',
            delivered: 'completed',
            cancelled: 'completed'
        })[status] || 'pending';
    }

    function summarizeOrder(order) {
        return order.items.map((item) => `${item.quantity} × ${item.name}`).join(', ');
    }

    function renderDashboardData(orders) {
        if (!document.querySelector('#dashboard-revenue')) return;
        const completedOrders = orders.filter((order) => order.status !== 'cancelled');
        const gross = completedOrders.reduce((sum, order) => sum + order.subtotal, 0);
        const average = completedOrders.length ? Math.round(gross / completedOrders.length) : 0;
        const liveOrders = orders.filter((order) => !['delivered', 'cancelled'].includes(order.status));
        const zones = new Set(liveOrders.map((order) => order.zone));
        document.querySelector('#dashboard-revenue').textContent = formatMoney(gross);
        document.querySelector('#dashboard-order-count').textContent = String(orders.length);
        document.querySelector('#dashboard-rating').textContent = '-';
        document.querySelector('.stats-grid .stat-card:nth-child(3) small').textContent = 'Ratings appear after customer reviews';
        document.querySelector('#dashboard-live-orders').textContent = String(liveOrders.length);
        document.querySelector('#dashboard-average-order').textContent = formatMoney(average);
        document.querySelector('#dashboard-active-zones').textContent = String(zones.size);

        const popularItems = new Map();
        completedOrders.forEach((order) => order.items.forEach((item) => {
            const current = popularItems.get(item.id) || { ...item, quantity: 0, revenue: 0 };
            current.quantity += item.quantity;
            current.revenue += item.price * item.quantity;
            popularItems.set(item.id, current);
        }));
        const rankedItems = [...popularItems.values()].sort((first, second) => second.quantity - first.quantity);
        const menuList = document.querySelector('#dashboard-popular-items');
        const featuredName = document.querySelector('#dashboard-featured-name');
        const featuredImage = document.querySelector('#dashboard-featured-image');
        if (rankedItems.length) {
            const catalogItems = getCatalog().flatMap((restaurant) => restaurant.items);
            menuList.innerHTML = rankedItems.slice(0, 4).map((item) => {
                const catalogItem = catalogItems.find((entry) => entry.id === item.id);
                return `<div class="menu-item">
                    <img src="${escapeHtml(catalogItem?.image || './images/imgi_110_G-Burger-By-Galaxy-Abuja-2.jpg')}" alt="">
                    <div><strong>${escapeHtml(item.name)}</strong><span>${item.quantity} sold</span></div>
                    <b>${formatMoney(item.revenue)}</b>
                </div>`;
            }).join('');
            featuredName.textContent = rankedItems[0].name;
            featuredImage.src = catalogItems.find((item) => item.id === rankedItems[0].id)?.image || './images/imgi_110_G-Burger-By-Galaxy-Abuja-2.jpg';
            document.querySelector('#dashboard-featured-count').textContent = `${rankedItems[0].quantity} sold`;
            document.querySelector('#dashboard-featured-price').textContent = formatMoney(rankedItems[0].revenue);
        } else {
            menuList.innerHTML = '<p class="vendor-empty-state">Popular dishes will appear after customers place orders.</p>';
            featuredName.textContent = 'No featured dish yet';
            featuredImage.hidden = true;
            document.querySelector('#dashboard-featured-count').textContent = 'Awaiting first order';
            document.querySelector('#dashboard-featured-price').textContent = '-';
        }

        const orderBody = document.querySelector('#dashboard-order-rows');
        if (orderBody) {
            const recent = [...orders].sort((first, second) => second.createdAt - first.createdAt).slice(0, 6);
            orderBody.innerHTML = recent.length ? recent.map((order) => `<tr>
                <td><div class="customer-cell"><span class="avatar avatar-one">${escapeHtml(order.customerName.slice(0, 1).toUpperCase())}</span><span>${escapeHtml(order.customerName)}</span></div></td>
                <td>${escapeHtml(summarizeOrder(order))}</td>
                <td>${escapeHtml(order.zone)}</td>
                <td><span class="status ${orderStatusClass(order.status)}">${escapeHtml(orderStatusLabel(order.status))}</span></td>
                <td>${formatMoney(order.total)}</td>
                <td>${order.status === 'placed' ? `<button type="button" class="inventory-add" data-advance-order="${escapeHtml(order.id)}" data-next-status="confirmed">Confirm order</button>` : `<a href="daily-operations.html" class="view-all">Manage order</a>`}</td>
            </tr>`).join('') : '<tr><td colspan="5">No customer orders yet. New orders will appear here.</td></tr>';
        }

        const countsByDay = Array(7).fill(0);
        orders.forEach((order) => {
            const age = Date.now() - order.createdAt;
            if (age <= 7 * 24 * 60 * 60 * 1000) countsByDay[(new Date(order.createdAt).getDay() + 6) % 7] += 1;
        });
        const largestDay = Math.max(1, ...countsByDay);
        document.querySelectorAll('.chart-bars .bar-group').forEach((group, index) => {
            const bar = group.querySelector('.bar');
            bar.style.height = `${Math.max(4, countsByDay[index] / largestDay * 100)}%`;
            group.setAttribute('aria-label', `${group.querySelector('label').textContent}: ${countsByDay[index]} orders`);
        });
    }

    function renderDailyOperations(orders, restaurantId) {
        if (!document.querySelector('#daily-live-count')) return;
        const liveOrders = orders.filter((order) => !['delivered', 'cancelled'].includes(order.status));
        const riders = readList(ridersKey).filter((rider) => rider.restaurantId === restaurantId);
        document.querySelector('#daily-live-count').textContent = String(liveOrders.length);
        document.querySelector('#daily-preparing-count').textContent = String(orders.filter((order) => order.status === 'preparing').length);
        document.querySelector('#daily-rider-count').textContent = String(orders.filter((order) => order.status === 'picked-up').length);
        document.querySelector('#daily-order-subtitle').textContent = `${orders.length} total customer ${orders.length === 1 ? 'order' : 'orders'}`;
        document.querySelector('#daily-preparing-subtitle').textContent = `${orders.filter((order) => order.status === 'confirmed').length} confirmed and waiting to start`;
        document.querySelector('#daily-rider-subtitle').textContent = `${riders.filter((rider) => rider.status !== 'Available').length} of ${riders.length} registered riders assigned`;
        const deliveredCount = orders.filter((order) => order.status === 'delivered').length;
        document.querySelector('#daily-completion-rate').textContent = `${orders.length ? Math.round(deliveredCount / orders.length * 100) : 0}%`;
        const averageAge = liveOrders.length ? Math.round(liveOrders.reduce((sum, order) => sum + (Date.now() - order.createdAt), 0) / liveOrders.length / 60000) : 0;
        document.querySelector('#daily-average-wait').textContent = `${averageAge} min`;

        const container = document.querySelector('#live-order-list');
        if (container) {
            const nextStatus = { placed: 'confirmed', confirmed: 'preparing', preparing: 'picked-up', 'picked-up': 'delivered' };
            container.innerHTML = liveOrders.length ? [...liveOrders].sort((first, second) => second.createdAt - first.createdAt).map((order) => {
                const next = nextStatus[order.status];
                const remaining = Math.max(0, Math.ceil((order.createdAt + (order.etaMinutes + (order.delayMinutes || 0)) * 60000 - Date.now()) / 60000));
                return `<article class="live-order-item">
                    <div class="order-meta"><strong>${escapeHtml(order.id)}</strong><span>${escapeHtml(order.customerName)} · ${escapeHtml(order.zone)}</span></div>
                    <div class="order-details"><span class="order-name">${escapeHtml(summarizeOrder(order))}</span><span class="tiny-tag ${orderStatusClass(order.status)}">${escapeHtml(orderStatusLabel(order.status))}</span></div>
                    <small>${remaining ? `ETA: ${remaining} min` : 'Arrival expected now'} · ${formatMoney(order.total)}</small>
                    <div class="vendor-order-actions">
                        <a href="track-order.html?order=${encodeURIComponent(order.id)}" class="view-all">Customer tracking</a>
                        ${next ? `<button type="button" class="inventory-add" data-advance-order="${escapeHtml(order.id)}" data-next-status="${next}">Mark ${escapeHtml(orderStatusLabel(next))}</button>` : ''}
                    </div>
                </article>`;
            }).join('') : '<p class="vendor-empty-state">No live orders yet. Customer orders will appear here after checkout.</p>';
        }

        const alerts = document.querySelector('#ops-alerts');
        if (alerts) {
            const lowStock = readList(inventoryKey).filter((item) => item.available && item.stock <= 5);
            const delayed = liveOrders.filter((order) => order.delayMinutes > 0);
            const messages = [
                ...lowStock.map((item) => `Low stock: ${item.name} (${item.stock} portions)`),
                ...delayed.map((order) => `${order.id} has a ${order.delayMinutes} min delay`)
            ];
            alerts.innerHTML = messages.length ? messages.map((message) => `<li>${escapeHtml(message)}</li>`).join('') : '<li>No urgent order or stock alerts.</li>';
        }

        const riderGrid = document.querySelector('#riders');
        const riderForm = document.querySelector('#rider-form');
        if (riderGrid && riderForm) {
            riderGrid.innerHTML = riders.length ? riders.map((rider, index) => `<article class="rider-card">
                <div class="rider-avatar ${['orange', 'cream', 'green', 'peach'][index % 4]}">${escapeHtml(rider.name.slice(0, 1).toUpperCase())}</div>
                <div><strong>${escapeHtml(rider.name)}</strong><span>${escapeHtml(rider.status)} · ${escapeHtml(rider.phone)}</span></div>
            </article>`).join('') : '<p class="vendor-empty-state">No riders added yet. Add your first rider below.</p>';
            riderForm.addEventListener('submit', (event) => {
                event.preventDefault();
                if (!riderForm.reportValidity()) return;
                const nextRiders = readList(ridersKey);
                nextRiders.push({
                    id: `rider-${Date.now().toString(36)}`,
                    restaurantId,
                    name: riderForm.elements['rider-name'].value.trim(),
                    phone: riderForm.elements['rider-phone'].value.trim(),
                    status: riderForm.elements['rider-status'].value
                });
                saveList(ridersKey, nextRiders);
                window.location.reload();
            });
        }
    }

    function setupInventory(restaurantId) {
        const form = document.querySelector('.inventory-form');
        const inventoryList = document.querySelector('#inventory-list');
        const restaurantSelect = document.querySelector('#inventory-restaurant');
        if (!form || !inventoryList || !restaurantSelect) return;

        const catalog = getCatalog().filter((restaurant) => restaurant.id === restaurantId);
        restaurantSelect.innerHTML = catalog.map((restaurant) => `<option value="${escapeHtml(restaurant.id)}">${escapeHtml(restaurant.name)}</option>`).join('');
        restaurantSelect.disabled = catalog.length === 1;

        function renderInventory() {
            const restaurantId = restaurantSelect.value;
            const restaurant = getCatalog().find((item) => item.id === restaurantId);
            if (!restaurant) return;
            const baseItems = restaurant.items.map((item) => ({ ...item, stock: item.stock ?? 20 }));
            inventoryList.innerHTML = baseItems.length ? baseItems.map((item) => `<div class="inventory-item">
                <div><strong>${escapeHtml(item.name)}</strong><small>${item.stock} portions listed</small></div>
                <span class="status ${item.available === false ? 'completed' : item.stock <= 5 ? 'preparing' : 'accepted'}">${item.available === false ? 'Paused' : item.stock <= 5 ? 'Low stock' : 'Available'}</span>
                <button type="button" class="inventory-remove" data-toggle-item="${escapeHtml(item.id)}" data-custom-item="${item.id.startsWith('vendor-')}">${item.available === false ? 'Restore' : 'Pause'}</button>
            </div>`).join('') : '<p class="vendor-empty-state">No menu items listed for this restaurant.</p>';
        }

        restaurantSelect.addEventListener('change', renderInventory);
        inventoryList.addEventListener('click', (event) => {
            const button = event.target.closest('[data-toggle-item]');
            if (!button) return;
            const itemId = button.dataset.toggleItem;
            const isAvailable = button.textContent.trim() !== 'Restore';
            if (button.dataset.customItem === 'true') {
                const items = readList(inventoryKey);
                const item = items.find((entry) => entry.id === itemId);
                if (item) item.available = !isAvailable;
                saveList(inventoryKey, items);
            } else {
                const availability = readObject(availabilityKey);
                availability[itemId] = !isAvailable;
                localStorage.setItem(availabilityKey, JSON.stringify(availability));
            }
            renderInventory();
        });

        form.addEventListener('submit', (event) => {
            event.preventDefault();
            if (!form.reportValidity()) return;
            const restaurant = getCatalog().find((item) => item.id === restaurantSelect.value);
            if (!restaurant) return;
            const name = form.elements['item-name'].value.trim();
            const items = readList(inventoryKey);
            items.push({
                id: `vendor-${Date.now().toString(36)}`,
                restaurantId: restaurant.id,
                name,
                price: Number(form.elements['item-price'].value),
                stock: Number(form.elements['item-stock'].value),
                description: `${name} from ${restaurant.name}.`,
                category: form.elements['item-category'].value,
                image: restaurant.image,
                available: true
            });
            saveList(inventoryKey, items);
            form.reset();
            restaurantSelect.value = restaurant.id;
            renderInventory();
        });

        renderInventory();
    }

    function setupBusinessManagement(session, orders) {
        if (!document.querySelector('#finance-gross')) return;
        const eligibleOrders = orders.filter((order) => order.status !== 'cancelled');
        const gross = eligibleOrders.reduce((sum, order) => sum + order.subtotal, 0);
        const commission = Math.round(gross * 0.05);
        const delivery = eligibleOrders.reduce((sum, order) => sum + order.deliveryFee, 0);
        const net = gross - commission;
        document.querySelector('#finance-gross').textContent = formatMoney(gross);
        document.querySelector('#finance-breakdown-gross').textContent = formatMoney(gross);
        document.querySelector('#finance-commission').textContent = formatMoney(commission);
        document.querySelector('#finance-breakdown-commission').textContent = `-${formatMoney(commission)}`;
        document.querySelector('#finance-commission-total').textContent = formatMoney(commission);
        document.querySelector('#finance-delivery').textContent = formatMoney(delivery);
        document.querySelector('#finance-promos').textContent = formatMoney(0);
        document.querySelector('#finance-net').textContent = formatMoney(net);
        document.querySelector('#finance-breakdown-net').textContent = formatMoney(net);
        document.querySelector('#vendor-profile-name').textContent = session.displayName;
        const account = loadAccounts().find((item) => item.username === session.username);
        document.querySelector('#vendor-profile-zone').textContent = account?.zone || 'Abuja';

        const settlementPanel = document.querySelector('#payout-timeline');
        const deliveredOrders = orders.filter((order) => order.status === 'delivered');
        const deliveredGross = deliveredOrders.reduce((sum, order) => sum + order.subtotal, 0);
        const payout = deliveredGross - Math.round(deliveredGross * 0.05);
        settlementPanel.innerHTML = deliveredOrders.length ? `<div class="timeline-item">
            <span class="timeline-date">${deliveredOrders.length} orders</span>
            <div><strong>${formatMoney(payout)} estimated payout</strong><small>After the 5% platform commission; no bank transfer is connected.</small></div>
            <span class="status preparing">Preview</span>
        </div>` : '<p class="vendor-empty-state">Delivered orders will appear here as a payout preview.</p>';

        const settingsKey = `munchifyVendorSettings:${session.username}`;
        const settings = readObject(settingsKey);
        const opening = document.querySelector('#vendor-opening-time');
        const closing = document.querySelector('#vendor-closing-time');
        const kitchen = document.querySelector('#vendor-kitchen-status');
        opening.value = settings.opening || opening.value;
        closing.value = settings.closing || closing.value;
        kitchen.value = settings.kitchen || kitchen.value;
        [opening, closing, kitchen].forEach((field) => field.addEventListener('change', () => {
            localStorage.setItem(settingsKey, JSON.stringify({ opening: opening.value, closing: closing.value, kitchen: kitchen.value }));
        }));
    }

    function setupDeliveryDynamics(orders, restaurantId) {
        if (!document.querySelector('#delivery-average-eta')) return;
        const liveOrders = orders.filter((order) => !['delivered', 'cancelled'].includes(order.status));
        const activeRiders = readList(ridersKey).filter((rider) => rider.restaurantId === restaurantId && rider.status !== 'Available');
        const totalEta = liveOrders.reduce((sum, order) => sum + order.etaMinutes + (order.delayMinutes || 0), 0);
        document.querySelector('#delivery-average-eta').textContent = `${liveOrders.length ? Math.round(totalEta / liveOrders.length) : 0} min`;
        const delayedOrders = liveOrders.filter((order) => order.delayMinutes > 0);
        const activeZones = new Set(liveOrders.map((order) => order.zone));
        document.querySelector('#delivery-delay-count').textContent = String(delayedOrders.length);
        document.querySelector('#delivery-zone-count').textContent = `${activeZones.size} ${activeZones.size === 1 ? 'zone' : 'zones'}`;
        document.querySelector('#delivery-active-alerts').textContent = `${delayedOrders.length} ${delayedOrders.length === 1 ? 'alert' : 'alerts'}`;
        document.querySelector('#delivery-active-riders').textContent = `${activeRiders.length} riders`;
        document.querySelector('#delivery-delay-note').textContent = delayedOrders.length ? `${delayedOrders.length} order${delayedOrders.length === 1 ? '' : 's'} with adjusted ETAs` : 'No order delays reported';
        document.querySelector('#delivery-coverage-note').textContent = `${activeZones.size} active delivery area${activeZones.size === 1 ? '' : 's'}`;

        const dispatchTimeline = document.querySelector('#dispatch-timeline');
        if (dispatchTimeline) {
            dispatchTimeline.innerHTML = liveOrders.length ? [...liveOrders].sort((first, second) => first.createdAt - second.createdAt).map((order) => {
                const eta = Math.max(0, Math.ceil((order.createdAt + (order.etaMinutes + (order.delayMinutes || 0)) * 60000 - Date.now()) / 60000));
                return `<div class="timeline-item">
                    <span class="timeline-date">${eta ? `+${eta} min` : 'Now'}</span>
                    <div><strong>${escapeHtml(order.id)}</strong><small>${escapeHtml(order.zone)} · ${escapeHtml(order.customerName)}</small></div>
                    <span class="status ${orderStatusClass(order.status)}">${escapeHtml(orderStatusLabel(order.status))}</span>
                </div>`;
            }).join('') : '<p class="vendor-empty-state">No active deliveries in the queue.</p>';
        }

        const orderSelect = document.querySelector('#delay-order-id');
        if (orderSelect) {
            const selected = orderSelect.value;
            orderSelect.innerHTML = '<option value="">Choose an active order</option>' + liveOrders.map((order) => `<option value="${escapeHtml(order.id)}">${escapeHtml(order.id)} · ${escapeHtml(order.customerName)} · ${escapeHtml(order.zone)}</option>`).join('');
            if (liveOrders.some((order) => order.id === selected)) orderSelect.value = selected;
        }

        const zoneGrid = document.querySelector('.zone-grid');
        if (zoneGrid) {
            const counts = liveOrders.reduce((result, order) => {
                result[order.zone] = (result[order.zone] || 0) + 1;
                return result;
            }, {});
            zoneGrid.innerHTML = Object.entries(counts).length ? Object.entries(counts).map(([zone, count]) => `<div class="zone-card"><strong>${escapeHtml(zone)}</strong><span>${count} live ${count === 1 ? 'order' : 'orders'}</span><em>${count} active delivery</em></div>`).join('') : '<p class="vendor-empty-state">Delivery-zone activity will appear when orders are placed.</p>';
        }

        const delayForm = document.querySelector('#delay-form');
        if (delayForm) delayForm.querySelectorAll('[data-delay-action]').forEach((button) => {
            button.addEventListener('click', () => {
                if (!delayForm.reportValidity()) return;
                const orderId = delayForm.elements['order-id'].value;
                const minutes = Number(delayForm.elements.minutes.value);
                const reason = delayForm.elements.reason.value;
                const note = delayForm.elements.note.value.trim();
                const updated = updateStoredOrder(orderId, (order) => {
                    order.delayMinutes = minutes;
                    if (button.dataset.delayAction === 'notify') addOrderEvent(order, order.status, `${note} Reason: ${reason}. New estimated delay: ${order.delayMinutes} minutes.`);
                });
                if (updated) {
                    const feedback = document.querySelector('#delivery-feedback');
                    feedback.textContent = button.dataset.delayAction === 'notify' ? 'Updated arrival time sent to the customer tracker.' : 'Delay estimate saved.';
                    window.setTimeout(() => window.location.reload(), 350);
                }
            });
        });
    }

    function setupVendorSearch() {
        document.querySelectorAll('.search-box input').forEach((input) => {
            const feedback = document.createElement('span');
            feedback.className = 'vendor-search-feedback';
            feedback.setAttribute('role', 'status');
            feedback.hidden = true;
            input.closest('.search-box').after(feedback);

            input.addEventListener('input', () => {
                const query = input.value.trim().toLowerCase();
                const searchableItems = document.querySelectorAll('tbody tr, .live-order-item, .inventory-item, .zone-card, .finance-row, .menu-item');
                let visibleCount = 0;
                searchableItems.forEach((item) => {
                    item.hidden = query !== '' && !item.textContent.toLowerCase().includes(query);
                    if (!item.hidden) visibleCount += 1;
                });
                feedback.textContent = query && visibleCount === 0 ? `No results for "${input.value.trim()}".` : '';
                feedback.hidden = !feedback.textContent;
            });
            input.addEventListener('keydown', (event) => {
                if (event.key !== 'Escape') return;
                input.value = '';
                input.dispatchEvent(new Event('input', { bubbles: true }));
            });
        });
    }

    function setupVendorProfilePhoto(session) {
            const storageKey = `munchifyVendorProfilePhoto:${session.username}`;
            const sidebarPhoto = document.querySelector('#vendor-sidebar-photo');
            const profilePhoto = document.querySelector('#vendor-profile-photo');
            const profileInitial = document.querySelector('#vendor-profile-initial');
            const fileInput = document.querySelector('#vendor-profile-photo-input');
            const removeButton = document.querySelector('#vendor-profile-photo-remove');
            const status = document.querySelector('#vendor-profile-photo-status');
            const defaultPhoto = './images/Hamburger-cuate.svg';

            function applyPhoto(photoData) {
                if (sidebarPhoto) sidebarPhoto.src = photoData || defaultPhoto;
                if (profilePhoto) {
                    profilePhoto.src = photoData || '';
                    profilePhoto.hidden = !photoData;
                }
                if (profileInitial) {
                    profileInitial.textContent = session.displayName.slice(0, 1).toUpperCase();
                    profileInitial.hidden = Boolean(photoData);
                }
                if (removeButton) removeButton.hidden = !photoData;
            }

            applyPhoto(localStorage.getItem(storageKey));
            if (!fileInput) return;

            fileInput.addEventListener('change', async () => {
                const file = fileInput.files?.[0];
                if (!file) return;
                if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 10 * 1024 * 1024) {
                    status.textContent = 'Choose a JPG, PNG, WEBP, or GIF image smaller than 10 MB.';
                    fileInput.value = '';
                    return;
                }

                try {
                    const bitmap = await createImageBitmap(file);
                    const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
                    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
                    const context = canvas.getContext('2d');
                    context.fillStyle = '#fff';
                    context.fillRect(0, 0, canvas.width, canvas.height);
                    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
                    bitmap.close();

                    const compressedBlob = await new Promise((resolve, reject) => {
                        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Image compression failed.')), 'image/jpeg', 0.82);
                    });
                    const photoData = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = () => reject(reader.error);
                        reader.readAsDataURL(compressedBlob);
                    });
                    localStorage.setItem(storageKey, photoData);
                    applyPhoto(photoData);
                    status.textContent = 'Profile photo updated.';
                } catch {
                    status.textContent = 'This image could not be processed. Try another photo.';
                }
                fileInput.value = '';
            });

            removeButton.addEventListener('click', () => {
                localStorage.removeItem(storageKey);
                applyPhoto('');
                status.textContent = 'Profile photo removed.';
            });
        }

    function setupVendorShell(session, orders, restaurantId) {
        const mainContainer = document.querySelector('.main-container');
        const sidebarToggle = document.querySelector('.sd-toggle');
        const sidebarKey = `munchifySidebarCollapsed:${session.username}`;
        if (mainContainer && sidebarToggle) {
            const applyCollapsedState = (collapsed) => {
                mainContainer.classList.toggle('sidebar-collapsed', collapsed);
                sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
                sidebarToggle.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
                sidebarToggle.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
            };
            applyCollapsedState(localStorage.getItem(sidebarKey) === 'true');
            sidebarToggle.addEventListener('click', () => {
                const collapsed = !mainContainer.classList.contains('sidebar-collapsed');
                localStorage.setItem(sidebarKey, String(collapsed));
                applyCollapsedState(collapsed);
            });
        }

        document.querySelectorAll('.icon-btn[aria-label="Settings"]').forEach((button) => {
            button.addEventListener('click', () => {
                const profile = document.querySelector('#vendor-profile-box');
                if (profile) profile.scrollIntoView({ behavior: 'smooth', block: 'center' });
                else window.location.assign('business-management.html#vendor-profile-box');
            });
        });

        const notificationsButton = document.querySelector('.icon-btn[aria-label="Notifications"]');
        if (!notificationsButton) return;

        let dialog = document.querySelector('#vendor-notification-dialog');
        if (!dialog) {
            dialog = document.createElement('dialog');
            dialog.id = 'vendor-notification-dialog';
            dialog.className = 'vendor-notification-dialog';
            dialog.innerHTML = '<div class="vendor-notification-heading"><div><p class="eyebrow">ACTIVITY</p><h2>Notifications</h2></div><button type="button" aria-label="Close notifications">×</button></div><ul></ul>';
            document.body.append(dialog);
            dialog.querySelector('button').addEventListener('click', () => dialog.close());
            dialog.addEventListener('click', (event) => {
                if (event.target === dialog) dialog.close();
            });
        }

        const notifications = [];
        orders.forEach((order) => {
            if (order.status === 'placed') notifications.push(`New order ${order.id} from ${order.customerName} needs confirmation.`);
            if (order.delayMinutes > 0) notifications.push(`${order.id} has an updated ${order.delayMinutes} minute delivery delay.`);
        });
        readList(inventoryKey).filter((item) => item.restaurantId === restaurantId && item.available && item.stock <= 5)
            .forEach((item) => notifications.push(`${item.name} is low on stock (${item.stock} portions left).`));
        const notificationList = dialog.querySelector('ul');
        notificationsButton.setAttribute('data-notification-count', String(notifications.length));
        notificationsButton.title = notifications.length ? `${notifications.length} notifications` : 'No new notifications';
        notificationList.innerHTML = notifications.length
            ? notifications.map((notification) => `<li>${escapeHtml(notification)}</li>`).join('')
            : '<li>No new order, delivery, or stock notifications.</li>';
        notificationsButton.addEventListener('click', () => dialog.showModal());
    }

    function setupVendorPages() {
        if (!document.querySelector('.main-container')) return;

        const session = getCurrentSession();
        const account = session && loadAccounts().find((item) => item.username === session.username);
        const restaurantId = session?.restaurantId || account?.restaurantId;
        const restaurant = getCatalog().find((item) => item.id === restaurantId);
        if (!session || session.role !== 'restaurant' || !restaurant) {
            window.location.replace('auth.html#login');
            return;
        }

        const vendorSession = { ...session, restaurantId, displayName: restaurant.name };
        const nameLabel = document.querySelector('#user-name');
        if (nameLabel) nameLabel.textContent = restaurant.name;
        setupVendorProfilePhoto(vendorSession);

        document.querySelectorAll('#log-out-btn').forEach((button) => {
            button.addEventListener('click', () => {
                clearAuthSession();
                window.location.assign('index.html');
            });
        });

        const orders = readList(ordersKey).filter((order) => order.restaurantId === restaurantId);
        renderDashboardData(orders);
        renderDailyOperations(orders, restaurantId);
        setupInventory(restaurantId);
        setupBusinessManagement(vendorSession, orders);
        setupDeliveryDynamics(orders, restaurantId);
        setupVendorSearch();
        setupVendorShell(vendorSession, orders, restaurantId);

        [document.querySelector('#live-order-list'), document.querySelector('#dashboard-order-rows')].filter(Boolean).forEach((container) => {
            container.addEventListener('click', (event) => {
                const button = event.target.closest('[data-advance-order]');
                if (!button) return;
                updateStoredOrder(button.dataset.advanceOrder, (order) => addOrderEvent(order, button.dataset.nextStatus, `Restaurant updated your order to ${orderStatusLabel(button.dataset.nextStatus)}.`));
                window.location.reload();
            });
        });
    }

    function setupCheckoutPage() {
        const checkoutForm = document.querySelector('#checkout-form');
        if (!checkoutForm) return;

        const itemsContainer = document.querySelector('#checkout-items');
        const emptyMessage = document.querySelector('#checkout-empty');
        const authNotice = document.querySelector('#checkout-auth-notice');
        const message = document.querySelector('#checkout-message');
        const placeOrderButton = checkoutForm.querySelector('[type="submit"]');

        function renderCheckout() {
            const cart = getCart();
            const { restaurant, lines } = getCartLines(cart);
            const session = getCurrentSession();
            const customerSignedIn = session?.role === 'customer';
            const hasItems = Boolean(restaurant && lines.length);
            const unavailableItem = lines.find((item) => item.available === false || (Number.isFinite(item.stock) && item.quantity > item.stock));

            emptyMessage.hidden = hasItems;
            const lineMarkup = lines.map((item) => `<article class="checkout-item" data-item-id="${escapeHtml(item.id)}">
                <img src="${escapeHtml(item.image || restaurant.image)}" alt="">
                <div class="checkout-item-copy"><strong>${escapeHtml(item.name)}</strong><span>${formatMoney(item.price)} each</span></div>
                <div class="quantity-control" aria-label="Quantity for ${escapeHtml(item.name)}">
                    <button type="button" data-quantity-change="-1" aria-label="Remove one ${escapeHtml(item.name)}">−</button>
                    <span>${item.quantity}</span>
                    <button type="button" data-quantity-change="1" aria-label="Add one ${escapeHtml(item.name)}">+</button>
                </div>
                <strong class="checkout-line-total">${formatMoney(item.price * item.quantity)}</strong>
            </article>`).join('');
            itemsContainer.innerHTML = hasItems ? `<div class="checkout-restaurant-heading">
                <strong>${escapeHtml(restaurant.name)}</strong><span>${restaurant.etaMinutes} min estimated delivery</span>
            </div>${lineMarkup}` : '';

            const subtotal = cartSubtotal(lines);
            const delivery = hasItems ? restaurant.deliveryFee : 0;
            document.querySelector('#checkout-subtotal').textContent = formatMoney(subtotal);
            document.querySelector('#checkout-delivery').textContent = formatMoney(delivery);
            document.querySelector('#checkout-total').textContent = formatMoney(subtotal + delivery);
            authNotice.hidden = !hasItems || customerSignedIn;
            checkoutForm.hidden = !hasItems || !customerSignedIn;
            placeOrderButton.disabled = !hasItems || !customerSignedIn || Boolean(unavailableItem);
            if (unavailableItem) message.textContent = `${unavailableItem.name} is unavailable in the selected quantity. Adjust your cart or choose another item.`;
            updateCartBadge();
        }

        itemsContainer.addEventListener('click', (event) => {
            const button = event.target.closest('[data-quantity-change]');
            if (!button) return;
            const cart = getCart();
            const item = cart.items.find((line) => line.itemId === button.closest('[data-item-id]').dataset.itemId);
            if (!item) return;
            item.quantity += Number(button.dataset.quantityChange);
            cart.items = cart.items.filter((line) => line.quantity > 0);
            if (!cart.items.length) cart.restaurantId = '';
            localStorage.setItem(cartKey, JSON.stringify(cart));
            renderCheckout();
        });

        checkoutForm.addEventListener('submit', (event) => {
            event.preventDefault();
            if (!checkoutForm.reportValidity()) return;
            const session = getCurrentSession();
            if (session?.role !== 'customer') {
                message.textContent = 'Sign in with a customer account to place your order.';
                return;
            }

            const cart = getCart();
            const { restaurant, lines } = getCartLines(cart);
            if (!restaurant || !lines.length) {
                renderCheckout();
                return;
            }
            const unavailableItem = lines.find((item) => item.available === false || (Number.isFinite(item.stock) && item.quantity > item.stock));
            if (unavailableItem) {
                message.textContent = `${unavailableItem.name} is unavailable in the selected quantity. Adjust your cart or choose another item.`;
                renderCheckout();
                return;
            }

            const subtotal = cartSubtotal(lines);
            const deliveryFee = restaurant.deliveryFee;
            const createdAt = Date.now();
            const order = {
                id: `MCH-${createdAt.toString(36).toUpperCase()}`,
                customerUsername: session.username,
                customerName: session.displayName,
                restaurantId: restaurant.id,
                restaurantName: restaurant.name,
                items: lines.map(({ id, name, price, quantity }) => ({ id, name, price, quantity })),
                address: checkoutForm.elements.address.value.trim(),
                zone: checkoutForm.elements.zone.value,
                instructions: checkoutForm.elements.instructions.value.trim(),
                paymentMethod: 'cash',
                subtotal,
                deliveryFee,
                total: subtotal + deliveryFee,
                status: 'placed',
                createdAt,
                etaMinutes: restaurant.etaMinutes,
                delayMinutes: 0,
                events: [{ status: 'placed', at: createdAt, note: 'Order sent to the restaurant.' }]
            };

            const orders = readList(ordersKey);
            orders.push(order);
            saveList(ordersKey, orders);
            const inventory = readList(inventoryKey);
            lines.forEach((line) => {
                const inventoryItem = inventory.find((item) => item.id === line.id);
                if (!inventoryItem || !Number.isFinite(inventoryItem.stock)) return;
                inventoryItem.stock = Math.max(0, inventoryItem.stock - line.quantity);
                if (inventoryItem.stock === 0) inventoryItem.available = false;
            });
            saveList(inventoryKey, inventory);
            localStorage.removeItem(cartKey);
            window.location.assign(`track-order.html?order=${encodeURIComponent(order.id)}`);
        });

        const signInLink = authNotice.querySelector('a');
        signInLink.href = 'auth.html?return=checkout.html#login';
        const latestOrder = readList(ordersKey).sort((first, second) => second.createdAt - first.createdAt)[0];
        if (latestOrder) document.querySelector('#checkout-track-link').href = `track-order.html?order=${encodeURIComponent(latestOrder.id)}`;
        renderCheckout();
    }

    function setupTrackingPage() {
        const content = document.querySelector('#tracking-content');
        if (!content) return;

        const orders = readList(ordersKey);
        const orderId = new URLSearchParams(window.location.search).get('order');
        const session = getCurrentSession();
        const order = orderId
            ? orders.find((item) => item.id === orderId)
            : orders.filter((item) => !session || item.customerUsername === session.username)
                .sort((first, second) => second.createdAt - first.createdAt)[0];

        if (!order) {
            document.querySelector('#tracking-empty').hidden = false;
            return;
        }

        content.hidden = false;
        document.querySelector('#tracking-order-id').textContent = order.id;
        document.querySelector('#tracking-restaurant-name').textContent = order.restaurantName;
        document.querySelector('#tracking-order-summary').textContent = `${order.items.reduce((sum, item) => sum + item.quantity, 0)} items from ${order.restaurantName}`;
        document.querySelector('#tracking-customer-name').textContent = order.customerName;
        document.querySelector('#tracking-address').textContent = `${order.address}, ${order.zone}`;
        document.querySelector('#tracking-instructions').textContent = order.instructions || 'No extra delivery instructions.';
        document.querySelector('#tracking-total').textContent = formatMoney(order.total);

        const statusLabels = {
            placed: 'Order placed',
            confirmed: 'Confirmed',
            preparing: 'Preparing',
            'picked-up': 'On the way',
            delivered: 'Delivered',
            cancelled: 'Cancelled'
        };
        const progressOrder = ['placed', 'confirmed', 'preparing', 'picked-up', 'delivered'];
        const badge = document.querySelector('#tracking-status-badge');
        const steps = [...document.querySelectorAll('#order-steps [data-step]')];
        const eventList = document.querySelector('#tracking-events');

        function updateTracking() {
            const latestOrder = readList(ordersKey).find((item) => item.id === order.id);
            if (latestOrder) Object.assign(order, latestOrder);
            const currentIndex = progressOrder.indexOf(order.status);
            badge.textContent = statusLabels[order.status] || statusLabels.placed;
            badge.className = `order-status-badge status-${order.status}`;
            steps.forEach((step) => {
                const stepIndex = progressOrder.indexOf(step.dataset.step);
                step.classList.toggle('is-complete', currentIndex >= stepIndex);
                step.classList.toggle('is-current', currentIndex === stepIndex);
                step.classList.toggle('is-cancelled', order.status === 'cancelled');
            });

            eventList.innerHTML = [...(order.events || [])].reverse().map((event) => `<li>
                <time datetime="${new Date(event.at).toISOString()}">${new Date(event.at).toLocaleString()}</time>
                <strong>${escapeHtml(statusLabels[event.status] || event.status)}</strong>
                <span>${escapeHtml(event.note || '')}</span>
            </li>`).join('');

            const arrivalAt = order.createdAt + (order.etaMinutes + (order.delayMinutes || 0)) * 60000;
            const remaining = Math.max(0, arrivalAt - Date.now());
            const eta = document.querySelector('#tracking-eta');
            const countdown = document.querySelector('#tracking-countdown');
            if (order.status === 'delivered') {
                eta.textContent = 'Your order has arrived';
                countdown.textContent = '';
            } else if (order.status === 'cancelled') {
                eta.textContent = 'Order cancelled';
                countdown.textContent = '';
            } else {
                eta.textContent = new Date(arrivalAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                const minutes = Math.floor(remaining / 60000);
                const seconds = Math.floor((remaining % 60000) / 1000).toString().padStart(2, '0');
                countdown.textContent = remaining ? `${minutes} min ${seconds} sec remaining` : 'Arriving now';
            }
        }

        updateTracking();
        window.setInterval(updateTracking, 1000);
    }

    document.addEventListener('DOMContentLoaded', () => {
        setupAuthForms();
        setupCustomerPage();
        setupCheckoutPage();
        setupTrackingPage();
        setupVendorPages();
    });
})();
