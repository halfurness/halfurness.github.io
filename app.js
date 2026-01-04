// Bakify Web - Recipe Viewer
// Reads recipes from Google Drive backup created by the Android app

const CONFIG = {
    // Replace with your Web OAuth Client ID from Google Cloud Console
    CLIENT_ID: '832233891140-tjhcm0u226tn7u8kft23epkgt42se7hb.apps.googleusercontent.com',
    SCOPES: 'https://www.googleapis.com/auth/drive.readonly',
    BACKUP_FOLDER_NAME: 'Bakify Backups',
    BACKUP_FILE_NAME: 'bakify_backup.json'
};

// State
let recipes = [];
let filteredRecipes = [];
let categories = [];
let activeCategory = null;
let accessToken = null;

// DOM Elements
const signInScreen = document.getElementById('sign-in-screen');
const mainScreen = document.getElementById('main-screen');
const detailScreen = document.getElementById('detail-screen');
const signInBtn = document.getElementById('sign-in-btn');
const signOutBtn = document.getElementById('sign-out-btn');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search');
const filterChips = document.getElementById('filter-chips');
const loadingEl = document.getElementById('loading');
const emptyState = document.getElementById('empty-state');
const recipeGrid = document.getElementById('recipe-grid');
const backBtn = document.getElementById('back-btn');
const shareBtn = document.getElementById('share-btn');
const detailTitle = document.getElementById('detail-title');
const detailContent = document.getElementById('detail-content');

// Initialize
document.addEventListener('DOMContentLoaded', init);

function init() {
    signInBtn.addEventListener('click', handleSignIn);
    signOutBtn.addEventListener('click', handleSignOut);
    searchInput.addEventListener('input', handleSearch);
    clearSearchBtn.addEventListener('click', clearSearch);
    backBtn.addEventListener('click', () => navigateTo(''));
    shareBtn.addEventListener('click', shareRecipe);

    // Handle browser back/forward
    window.addEventListener('hashchange', handleRoute);

    // Check for existing session
    const savedToken = sessionStorage.getItem('bakify_token');
    if (savedToken) {
        accessToken = savedToken;
        showMainScreen();
        loadRecipes();
    }
}

// Routing
function navigateTo(hash) {
    window.location.hash = hash;
}

function handleRoute() {
    const hash = window.location.hash.slice(1); // Remove #

    if (!accessToken) {
        showSignInScreen();
        return;
    }

    if (hash.startsWith('recipe/')) {
        const recipeUuid = hash.split('/')[1];
        const recipe = recipes.find(r => r.uuid === recipeUuid);
        if (recipe) {
            showRecipeDetail(recipe, false); // false = don't update hash again
            return;
        }
    }

    showMainScreen();
}

// Auth
function handleSignIn() {
    const client = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.CLIENT_ID,
        scope: CONFIG.SCOPES,
        callback: (response) => {
            if (response.access_token) {
                accessToken = response.access_token;
                sessionStorage.setItem('bakify_token', accessToken);
                showMainScreen();
                loadRecipes();
            }
        },
    });
    client.requestAccessToken();
}

function handleSignOut() {
    if (accessToken) {
        google.accounts.oauth2.revoke(accessToken);
    }
    accessToken = null;
    sessionStorage.removeItem('bakify_token');
    recipes = [];
    filteredRecipes = [];
    showSignInScreen();
}

// Screen Navigation
function showSignInScreen() {
    signInScreen.classList.remove('hidden');
    mainScreen.classList.add('hidden');
    detailScreen.classList.add('hidden');
}

function showMainScreen() {
    signInScreen.classList.add('hidden');
    mainScreen.classList.remove('hidden');
    detailScreen.classList.add('hidden');
}

function showDetailScreen() {
    signInScreen.classList.add('hidden');
    mainScreen.classList.add('hidden');
    detailScreen.classList.remove('hidden');
    window.scrollTo(0, 0);
}

// Drive API
async function loadRecipes() {
    showLoading();

    try {
        // Find backup folder
        const folderResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=name='${CONFIG.BACKUP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false&spaces=drive`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const folderData = await folderResponse.json();

        if (!folderData.files || folderData.files.length === 0) {
            showEmpty('No backup found. Create a backup in the Bakify app first.');
            return;
        }

        const folderId = folderData.files[0].id;

        // Find backup file
        const fileResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=name='${CONFIG.BACKUP_FILE_NAME}' and '${folderId}' in parents and trashed=false&spaces=drive`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const fileData = await fileResponse.json();

        if (!fileData.files || fileData.files.length === 0) {
            showEmpty('No backup file found.');
            return;
        }

        const fileId = fileData.files[0].id;

        // Download backup
        const contentResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const backup = await contentResponse.json();

        // Process recipes
        recipes = backup.recipes || [];

        // Attach base64 images to recipes
        if (backup.images) {
            recipes = recipes.map(recipe => {
                if (recipe.imageUri) {
                    const filename = recipe.imageUri.split('/').pop();
                    const base64 = backup.images[filename];
                    if (base64) {
                        recipe.imageData = `data:image/jpeg;base64,${base64}`;
                    }
                }
                return recipe;
            });
        }

        // Extract categories
        categories = [...new Set(recipes.map(r => r.category).filter(c => c))].sort();

        filteredRecipes = [...recipes];
        renderFilterChips();
        renderRecipes();

        // Check if URL has a recipe hash to navigate to
        handleRoute();

    } catch (error) {
        console.error('Error loading recipes:', error);
        if (error.message?.includes('401') || error.status === 401) {
            handleSignOut();
        } else {
            showEmpty('Error loading recipes. Please try again.');
        }
    }
}

// UI Rendering
function showLoading() {
    loadingEl.classList.remove('hidden');
    emptyState.classList.add('hidden');
    recipeGrid.classList.add('hidden');
}

function showEmpty(message = 'No recipes found') {
    loadingEl.classList.add('hidden');
    emptyState.classList.remove('hidden');
    emptyState.querySelector('p').textContent = message;
    recipeGrid.classList.add('hidden');
}

function renderFilterChips() {
    filterChips.innerHTML = '';

    if (categories.length === 0) return;

    // All chip
    const allChip = createChip('All', !activeCategory, () => {
        activeCategory = null;
        applyFilters();
    });
    filterChips.appendChild(allChip);

    // Category chips
    categories.forEach(category => {
        const chip = createChip(category, activeCategory === category, () => {
            activeCategory = category;
            applyFilters();
        });
        filterChips.appendChild(chip);
    });
}

function createChip(label, active, onClick) {
    const chip = document.createElement('button');
    chip.className = `chip${active ? ' active' : ''}`;
    chip.textContent = label;
    chip.addEventListener('click', onClick);
    return chip;
}

function renderRecipes() {
    loadingEl.classList.add('hidden');

    if (filteredRecipes.length === 0) {
        showEmpty();
        return;
    }

    emptyState.classList.add('hidden');
    recipeGrid.classList.remove('hidden');
    recipeGrid.innerHTML = '';

    filteredRecipes.forEach(recipe => {
        const card = createRecipeCard(recipe);
        recipeGrid.appendChild(card);
    });
}

function createRecipeCard(recipe) {
    const card = document.createElement('div');
    card.className = 'recipe-card';
    card.addEventListener('click', () => navigateTo(`recipe/${recipe.uuid}`));

    const totalTime = (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);
    const tags = recipe.tags ? recipe.tags.split(',').map(t => t.trim()).filter(t => t) : [];

    card.innerHTML = `
        ${recipe.imageData
            ? `<img class="recipe-card-image" src="${recipe.imageData}" alt="${escapeHtml(recipe.title)}">`
            : `<div class="recipe-card-image placeholder"><span class="material-icons">restaurant</span></div>`
        }
        <div class="recipe-card-content">
            <div class="recipe-card-title">
                ${recipe.isFavorite ? '<span class="material-icons recipe-card-favorite">favorite</span> ' : ''}
                ${escapeHtml(recipe.title)}
            </div>
            <div class="recipe-card-meta">
                ${totalTime > 0 ? `<span><span class="material-icons">schedule</span>${totalTime} min</span>` : ''}
                ${recipe.servings ? `<span><span class="material-icons">people</span>${recipe.servings}</span>` : ''}
            </div>
            ${recipe.category ? `<span class="recipe-card-category">${escapeHtml(recipe.category)}</span>` : ''}
            ${tags.length > 0 ? `
                <div class="recipe-card-tags">
                    ${tags.slice(0, 3).map(tag => `<span class="recipe-card-tag">${escapeHtml(tag)}</span>`).join('')}
                    ${tags.length > 3 ? `<span class="recipe-card-tag">+${tags.length - 3}</span>` : ''}
                </div>
            ` : ''}
        </div>
    `;

    return card;
}

let currentRecipe = null;

function showRecipeDetail(recipe, updateHash = true) {
    currentRecipe = recipe;
    detailTitle.textContent = recipe.title;

    if (updateHash && recipe.uuid) {
        window.location.hash = `recipe/${recipe.uuid}`;
    }

    const totalTime = (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);
    const tags = recipe.tags ? recipe.tags.split(',').map(t => t.trim()).filter(t => t) : [];

    detailContent.innerHTML = `
        ${recipe.imageData
            ? `<img class="detail-hero" src="${recipe.imageData}" alt="${escapeHtml(recipe.title)}">`
            : `<div class="detail-hero placeholder"><span class="material-icons">restaurant_menu</span></div>`
        }
        <div class="detail-body">
            <div class="detail-header">
                <h2>
                    ${recipe.isFavorite ? '<span class="material-icons recipe-card-favorite">favorite</span> ' : ''}
                    ${escapeHtml(recipe.title)}
                </h2>
                <div class="detail-header-meta">
                    ${recipe.prep_time_minutes ? `<span><span class="material-icons">hourglass_top</span>Prep: ${recipe.prep_time_minutes} min</span>` : ''}
                    ${recipe.cook_time_minutes ? `<span><span class="material-icons">local_fire_department</span>Cook: ${recipe.cook_time_minutes} min</span>` : ''}
                    ${totalTime > 0 ? `<span><span class="material-icons">schedule</span>Total: ${totalTime} min</span>` : ''}
                    ${recipe.servings ? `<span><span class="material-icons">people</span>${recipe.servings} servings</span>` : ''}
                </div>
                ${recipe.category ? `<span class="detail-category">${escapeHtml(recipe.category)}</span>` : ''}
                ${tags.length > 0 ? `
                    <div class="detail-tags">
                        ${tags.map(tag => `<span class="detail-tag">${escapeHtml(tag)}</span>`).join('')}
                    </div>
                ` : ''}
            </div>

            ${recipe.description ? `<p class="detail-description">${escapeHtml(recipe.description)}</p>` : ''}

            ${recipe.nutrition ? `
                <div class="detail-section">
                    <h3><span class="material-icons">monitor_weight</span>Nutrition</h3>
                    <div class="detail-section-content">${escapeHtml(recipe.nutrition)}</div>
                </div>
            ` : ''}

            ${recipe.notes ? `
                <div class="detail-section">
                    <h3><span class="material-icons">sticky_note_2</span>Notes</h3>
                    <div class="detail-section-content">${escapeHtml(recipe.notes)}</div>
                </div>
            ` : ''}

            ${recipe.ingredients ? `
                <div class="detail-section">
                    <h3><span class="material-icons">shopping_cart</span>Ingredients</h3>
                    <div class="detail-section-content">${formatContent(recipe.ingredients)}</div>
                </div>
            ` : ''}

            ${recipe.instructions ? `
                <div class="detail-section">
                    <h3><span class="material-icons">format_list_numbered</span>Instructions</h3>
                    <div class="detail-section-content">${formatContent(recipe.instructions)}</div>
                </div>
            ` : ''}

            ${recipe.source ? `
                <div class="detail-source">
                    <a href="${escapeHtml(recipe.source)}" target="_blank" rel="noopener noreferrer">
                        <span class="material-icons">link</span>
                        View source
                    </a>
                </div>
            ` : ''}
        </div>
    `;

    showDetailScreen();
}

function hideDetail() {
    currentRecipe = null;
    showMainScreen();
}

function shareRecipe() {
    if (!currentRecipe) return;

    const text = generateShareText(currentRecipe);

    if (navigator.share) {
        navigator.share({
            title: currentRecipe.title,
            text: text
        }).catch(() => {});
    } else {
        navigator.clipboard.writeText(text).then(() => {
            alert('Recipe copied to clipboard!');
        }).catch(() => {
            alert('Could not copy recipe.');
        });
    }
}

function generateShareText(recipe) {
    let text = `${recipe.title}\n\n`;

    if (recipe.description) {
        text += `${recipe.description}\n\n`;
    }

    const totalTime = (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);
    text += `Prep: ${recipe.prep_time_minutes || 0} min | Cook: ${recipe.cook_time_minutes || 0} min | Servings: ${recipe.servings || 1}\n`;

    if (recipe.category) {
        text += `Category: ${recipe.category}\n`;
    }

    if (recipe.ingredients) {
        text += `\nIngredients:\n${recipe.ingredients}\n`;
    }

    if (recipe.instructions) {
        text += `\nInstructions:\n${recipe.instructions}\n`;
    }

    if (recipe.source) {
        text += `\nSource: ${recipe.source}\n`;
    }

    text += `\n— Shared from Bakify`;

    return text;
}

// Search & Filter
function handleSearch() {
    const query = searchInput.value.trim();
    clearSearchBtn.classList.toggle('hidden', !query);
    applyFilters();
}

function clearSearch() {
    searchInput.value = '';
    clearSearchBtn.classList.add('hidden');
    applyFilters();
}

function applyFilters() {
    const query = searchInput.value.trim().toLowerCase();

    filteredRecipes = recipes.filter(recipe => {
        // Category filter
        if (activeCategory && recipe.category !== activeCategory) {
            return false;
        }

        // Search filter
        if (query) {
            const searchFields = [
                recipe.title,
                recipe.description,
                recipe.ingredients,
                recipe.category,
                recipe.tags
            ].filter(Boolean).map(s => s.toLowerCase());

            return searchFields.some(field => field.includes(query));
        }

        return true;
    });

    renderFilterChips();
    renderRecipes();
}

// Utilities
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatContent(text) {
    if (!text) return '';
    // Convert markdown-style bold to HTML
    let formatted = escapeHtml(text);
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/__(.*?)__/g, '<u>$1</u>');
    return formatted;
}
