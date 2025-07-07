const firebaseConfig = {
    apiKey: "AIzaSyDrw18otUXUzzKPR2Q_jxAE2NqrvL4gj9I",
    authDomain: "leo-iphone-5c9a0.firebaseapp.com",
    projectId: "leo-iphone-5c9a0",
    storageBucket: "leo-iphone-5c9a0.firebasestorage.app",
    messagingSenderId: "484759088723",
    appId: "1:484759088723:web:7059fea6ebb48f1dcde0a6"
};

const appId = firebaseConfig.appId;

const initialAuthToken = null;

console.log("Configuração Firebase em uso (Local):", firebaseConfig);
console.log("Token de autenticação inicial (Local):", initialAuthToken);
console.log("App ID em uso (Local):", appId);

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

let app;
let db;
let auth;
let storage;
let userId = null;
let items = [];
let categories = [];
let uploadedImageUrlsAdd = [];
let uploadedImageUrlsEdit = [];
let editingItemId = null;
let itemToDeleteId = null;
let currentFilterCategory = 'all';
let uploadedImageFilesAdd = [];
let uploadedImageFilesEdit = [];

let currentCarouselImages = [];
let currentImageIndex = 0;
let currentProductInCarousel = null;
let touchStartX = 0;

async function initializeFirebase() {
    try {
        if (!firebaseConfig || Object.keys(firebaseConfig).length === 0 || !firebaseConfig.projectId) {
            console.error("Firebase Config está vazio ou incompleto. Certifique-se de que preencheu as suas credenciais.");
            showMessage("Erro de Configuração", "As credenciais do Firebase não foram carregadas corretamente. Verifique o seu código.");
            return;
        }

        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        storage = getStorage(app);

        await signInAnonymously(auth);

        onAuthStateChanged(auth, (user) => {
            if (user) {
                userId = user.uid;
                console.log("Utilizador autenticado:", userId);
                loadCategoriesFromFirestore();
                loadItemsFromFirestore();
                updateAuthUI(true);
            } else {
                userId = null;
                console.log("Nenhum utilizador autenticado.");
                updateAuthUI(false);
            }
        });
    } catch (error) {
        console.error("Erro ao inicializar Firebase ou autenticar:", error);
        showMessage("Erro", "Falha ao conectar ao serviço de autenticação. Tente novamente.");
    }
}

async function loadCategoriesFromFirestore() {
    if (!db) {
        console.warn("Firestore não disponível para carregar categorias.");
        return;
    }
    try {
        const categoriesCollectionRef = collection(db, `artifacts/${appId}/public/data/categories`);
        onSnapshot(categoriesCollectionRef, (snapshot) => {
            const fetchedCategories = [];
            snapshot.forEach(doc => {
                fetchedCategories.push({ id: doc.id, ...doc.data() });
            });
            categories = fetchedCategories;
            populateCategoryDropdowns();
            renderItems();
        }, (error) => {
            console.error("Erro ao carregar categorias do Firestore:", error);
            showMessage("Erro", "Não foi possível carregar as categorias.");
        });
    } catch (error) {
        console.error("Erro ao carregar categorias do Firestore:", error);
        showMessage("Erro", "Não foi possível carregar as categorias.");
    }
}

async function loadItemsFromFirestore() {
    if (!db) {
        console.warn("Firestore não disponível para carregar itens.");
        return;
    }
    try {
        const itemsCollectionRef = collection(db, `artifacts/${appId}/public/data/items`);
        onSnapshot(itemsCollectionRef, (snapshot) => {
            const fetchedItems = [];
            snapshot.forEach(doc => {
                fetchedItems.push({ id: doc.id, ...doc.data() });
            });
            items = fetchedItems;
            renderItems();
        }, (error) => {
            console.error("Erro ao carregar itens do Firestore:", error);
            showMessage("Erro", "Não foi possível carregar os itens.");
        });

    } catch (error) {
        console.error("Erro ao carregar itens do Firestore:", error);
        showMessage("Erro", "Não foi possível carregar os itens.");
    }
}

const itemList = document.getElementById("itemList");
const itemModal = document.getElementById("itemModal");
const modalTitle = document.getElementById("modalTitle");
const productPriceInput = document.getElementById("productPrice");
const editProductPriceInput = document.getElementById("editProductPrice");
const modalDescription = document.getElementById("modalDescription");
const modalGallery = document.getElementById("modalGallery");
const authButton = document.getElementById("authButton");
const createProductButton = document.getElementById("createProductButton");
const createCategoryButton = document.getElementById("createCategoryButton");
const manageCategoriesButton = document.getElementById("manageCategoriesButton");
const messageModal = document.getElementById("messageModal");
const messageModalTitle = document.getElementById("messageModalTitle");
const messageModalText = document.getElementById("messageModalText");
const addProductModal = document.getElementById("addProductModal");
const addProductButton = document.getElementById('addProductButton');
const addProductSpinner = document.getElementById('addProductSpinner');
const editProductModal = document.getElementById("editProductModal");
const loginModal = document.getElementById("loginModal");
const addCategoryModal = document.getElementById("addCategoryModal");
const manageCategoriesModal = document.getElementById("manageCategoriesModal");
const manageCategoryList = document.getElementById("manageCategoryList");
const imageCarouselModal = document.getElementById('imageCarouselModal');
const carouselImage = document.getElementById('carouselImage');
const carouselCounter = document.getElementById('carouselCounter');
const imageLoader = document.getElementById('imageLoader');
const carouselProductTitle = document.getElementById('carouselProductTitle');
const carouselProductDescription = document.getElementById('carouselProductDescription');
const carouselProductPrice = document.getElementById('carouselProductPrice');
const fullscreenImageModal = document.getElementById('fullscreenImageModal');
const fullscreenImage = document.getElementById('fullscreenImage');
const productCategorySelect = document.getElementById('productCategory');
const editProductCategorySelect = document.getElementById('editProductCategory');
const productCodeInput = document.getElementById('productCode');
const editProductCodeInput = document.getElementById('editProductCode');
const categoryFilterDropdown = document.getElementById('categoryFilter');
const confirmModal = document.getElementById('confirmModal');
const confirmModalText = document.getElementById('confirmModalText');

const dropAreaAdd = document.getElementById('dropAreaAdd');
const imageUploadAdd = document.getElementById('imageUploadAdd');
const draggedImagesPreviewAdd = document.getElementById('draggedImagesPreviewAdd');

const dropAreaEdit = document.getElementById('dropAreaEdit');
const imageUploadEdit = document.getElementById('imageUploadEdit');
const draggedImagesPreviewEdit = document.getElementById('draggedImagesPreviewEdit');

const adminToken = "";

window.showMessage = function (title, message) {
    messageModalTitle.textContent = title;
    messageModalText.textContent = message;
    messageModal.style.display = "flex";
}

window.closeMessageModal = function () {
    messageModal.style.display = "none";
}

window.showConfirmModal = function (message, itemId, type = 'product') {
    confirmModalTitle.textContent = `Confirmar Exclusão de ${type === 'product' ? 'Produto' : 'Categoria'}`;
    confirmModalText.textContent = message;
    itemToDeleteId = itemId;
    confirmModal.dataset.deleteType = type;
    confirmModal.style.display = 'flex';
}

window.closeConfirmModal = function () {
    confirmModal.style.display = 'none';
    itemToDeleteId = null;
    confirmModal.dataset.deleteType = '';
}

window.executeConfirmedDeletion = async function () {
    const type = confirmModal.dataset.deleteType;
    if (itemToDeleteId) {
        if (type === 'product') {
            await window.deleteProduct(itemToDeleteId);
        } else if (type === 'category') {
            await window.deleteCategory(itemToDeleteId);
        }
        closeConfirmModal();
    }
}

function updateAuthUI(isAuthenticated) {
    if (isAuthenticated && localStorage.getItem("adminAuthenticated") === "true") {
        authButton.textContent = "Sair";
        authButton.classList.remove('login-btn');
        authButton.classList.add('logout-btn');
        createProductButton.style.display = "block";
        createCategoryButton.style.display = "block";
        manageCategoriesButton.style.display = "block";
    } else {
        authButton.textContent = "Login";
        authButton.classList.remove('logout-btn');
        authButton.classList.add('login-btn');
        createProductButton.style.display = "none";
        createCategoryButton.style.display = "none";
        manageCategoriesButton.style.display = "none";
        localStorage.removeItem("adminAuthenticated");
    }
    renderItems();
}

window.toggleAuth = function () {
    if (authButton.textContent === "Login") {
        openLoginModal();
    } else {
        logout();
    }
}

function populateCategoryDropdowns() {
    productCategorySelect.innerHTML = '<option value="">Selecione uma categoria</option>';
    editProductCategorySelect.innerHTML = '<option value="">Selecione uma categoria</option>';
    categoryFilterDropdown.innerHTML = '<option value="all">Tudo</option>';

    const sortedCategories = [...categories].sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();

        const getIphoneSortValue = (name) => {
            if (name.includes('iphone')) {
                if (name.includes('x') && !name.includes('xr')) return 10;
                if (name.includes('xr')) return 10.5;
                const match = name.match(/iphone\s*(\d+)/);
                return match ? parseInt(match[1], 10) : 9999;
            }
            return Infinity;
        };

        const aIphoneVal = getIphoneSortValue(aName);
        const bIphoneVal = getIphoneSortValue(bName);

        if (aIphoneVal !== Infinity || bIphoneVal !== Infinity) {
            if (aIphoneVal !== bIphoneVal) {
                return aIphoneVal - bIphoneVal;
            }
        }

        return aName.localeCompare(bName);
    });


    sortedCategories.forEach(category => {
        const optionAdd = document.createElement('option');
        optionAdd.value = category.id;
        optionAdd.textContent = category.name;
        productCategorySelect.appendChild(optionAdd);

        const optionEdit = document.createElement('option');
        optionEdit.value = category.id;
        optionEdit.textContent = category.name;
        editProductCategorySelect.appendChild(optionEdit);

        const optionFilter = document.createElement('option');
        optionFilter.value = category.id;
        optionFilter.textContent = category.name;
        categoryFilterDropdown.appendChild(optionFilter);
    });

    categoryFilterDropdown.value = currentFilterCategory;
}

window.filterProductsByCategory = function () {
    currentFilterCategory = categoryFilterDropdown.value;
    renderItems();
}

function sortItemsCustom(a, b) {
    const aTitle = a.title.toLowerCase();
    const bTitle = b.title.toLowerCase();

    const getIphoneSortValue = (title) => {
        if (title.includes('iphone')) {
            if (title.includes('x') && !title.includes('xr')) return 10;
            if (title.includes('xr')) return 10.5;
            const match = title.match(/iphone\s*(\d+)/);
            return match ? parseInt(match[1], 10) : 9999;
        }
        return Infinity;
    };

    const aIphoneVal = getIphoneSortValue(aTitle);
    const bIphoneVal = getIphoneSortValue(bTitle);

    if (aIphoneVal !== Infinity || bIphoneVal !== Infinity) {
        if (aIphoneVal !== bIphoneVal) {
            return aIphoneVal - bIphoneVal;
        }
    }

    return aTitle.localeCompare(bTitle);
}

function sortCategoriesForDisplay(a, b) {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();

    const getIphoneSortValue = (name) => {
        if (name.includes('iphone')) {
            if (name.includes('x') && !name.includes('xr')) return 10;
            if (name.includes('xr')) return 10.5;
            const match = name.match(/iphone\s*(\d+)/);
            return match ? parseInt(match[1], 10) : 9999;
        }
        return Infinity;
    };

    if (a.id === 'no-category') return 1;
    if (b.id === 'no-category') return -1;

    const aIphoneVal = getIphoneSortValue(aName);
    const bIphoneVal = getIphoneSortValue(bName);

    if (aIphoneVal !== Infinity || bIphoneVal !== Infinity) {
        if (aIphoneVal !== bIphoneVal) {
            return aIphoneVal - bIphoneVal;
        }
    }

    return aName.localeCompare(bName);
}

function renderItems() {
    itemList.innerHTML = "";
    let filteredItems = items;

    if (currentFilterCategory !== 'all') {
        filteredItems = items.filter(item => item.categoryId === currentFilterCategory);
    }

    filteredItems.sort(sortItemsCustom);

    const itemsByCategory = {};
    categories.forEach(cat => {
        itemsByCategory[cat.id] = { name: cat.name, items: [] };
    });
    itemsByCategory['no-category'] = { name: 'Sem Categoria', items: [] };

    filteredItems.forEach(item => {
        if (item.categoryId && itemsByCategory[item.categoryId]) {
            itemsByCategory[item.categoryId].items.push(item);
        } else {
            itemsByCategory['no-category'].items.push(item);
        }
    });

    let sortedCategoryGroups = Object.keys(itemsByCategory)
        .map(categoryId => ({ id: categoryId, name: itemsByCategory[categoryId].name, items: itemsByCategory[categoryId].items }))
        .filter(group => group.items.length > 0);

    sortedCategoryGroups.sort(sortCategoriesForDisplay);

    let hasContent = false;
    sortedCategoryGroups.forEach(categoryGroup => {
        const categoryData = categoryGroup;
        if (categoryData.items.length > 0) {
            hasContent = true;
            const categorySection = document.createElement('div');
            categorySection.className = 'category-section w-full';

            const categoryTitle = document.createElement('h2');
            categoryTitle.textContent = categoryData.name;
            categorySection.appendChild(categoryTitle);

            const ul = document.createElement('ul');
            ul.className = 'list-none p-0';

            categoryData.items.forEach(item => {
                const li = document.createElement("li");
                li.className = "item";
                li.onclick = () => openImageCarouselModal(item);

                const itemContent = document.createElement("div");
                itemContent.className = "item-content relative";

                const itemTitle = document.createElement("div");
                itemTitle.textContent = item.title;
                itemTitle.className = "item-title";
                itemContent.appendChild(itemTitle);

                if (item.code && item.code.trim() !== "") {
                    const productCodeSpan = document.createElement("span");
                    productCodeSpan.textContent = `cod:.${item.code}`;
                    productCodeSpan.className = "product-code";
                    itemContent.appendChild(productCodeSpan);
                }

                const itemDescription = document.createElement("div");
                itemDescription.textContent = item.description;
                itemDescription.className = "item-description";
                itemContent.appendChild(itemDescription);

                if (item.price !== undefined && item.price !== null) {
                    const itemPrice = document.createElement("div");
                    itemPrice.textContent = `R$ ${parseFloat(item.price).toFixed(2).replace('.', ',')}`;
                    itemPrice.className = "item-price text-lg font-semibold text-gold-400 mt-1";
                    itemContent.appendChild(itemPrice);
                }

                li.appendChild(itemContent);

                if (localStorage.getItem("adminAuthenticated") === "true") {
                    const itemActions = document.createElement("div");
                    itemActions.className = "item-actions";

                    const editButton = document.createElement("button");
                    editButton.textContent = "Editar";
                    editButton.className = "edit-btn";
                    editButton.onclick = (event) => {
                        event.stopPropagation();
                        openEditProductModal(item);
                    };
                    itemActions.appendChild(editButton);

                    const deleteButton = document.createElement("button");
                    deleteButton.textContent = "Remover";
                    deleteButton.className = "delete-btn";
                    deleteButton.onclick = (event) => {
                        event.stopPropagation();
                        showConfirmModal(`Tem certeza que deseja remover "${item.title}"?`, item.id, 'product');
                    };
                    itemActions.appendChild(deleteButton);

                    li.appendChild(itemActions);
                }
                ul.appendChild(li);
            });
            categorySection.appendChild(ul);
            itemList.appendChild(categorySection);
        }
    });

    if (!hasContent) {
        const noItemsMessage = document.createElement("li");
        noItemsMessage.textContent = "Nenhum item disponível na categoria selecionada.";
        noItemsMessage.className = "text-center text-gray-500 py-4";
        itemList.appendChild(noItemsMessage);
    }
}

window.openModal = function (item) {
    modalTitle.textContent = item.title;
    modalDescription.textContent = item.description;

    modalGallery.innerHTML = "";
    if (item.images && item.images.length > 0) {
        item.images.forEach(image => {
            const img = document.createElement("img");
            img.src = image;
            img.alt = `Imagem de ${item.title}`;
            img.onerror = function () {
                this.onerror = null;
                this.src = `https://placehold.co/150x150/cccccc/ffffff?text=Imagem+Nao+Disponivel`;
            };
            modalGallery.appendChild(img);
        });
    } else {
        const noImage = document.createElement("p");
        noImage.textContent = "Nenhuma imagem disponível.";
        noImage.className = "text-center text-gray-500";
        modalGallery.appendChild(noImage);
    }

    itemModal.style.display = "flex";
}

window.closeModal = function () {
    itemModal.style.display = "none";
}

window.openLoginModal = function () {
    loginModal.style.display = "flex";
}

window.closeLoginModal = function () {
    loginModal.style.display = "none";
}

window.authenticateAdmin = function () {
    const token = document.getElementById("adminTokenInput").value;
    if (token === adminToken) {
        localStorage.setItem("adminAuthenticated", "true");
        loginModal.style.display = "none";
        updateAuthUI(true);
        showMessage("Sucesso", "Login bem-sucedido!");
    } else {
        showMessage("Erro", "Token incorreto. Tente novamente.");
    }
}

async function logout() {
    try {
        await auth.signOut();
        localStorage.removeItem("adminAuthenticated");
        updateAuthUI(false);
        showMessage("Sucesso", "Logout realizado com sucesso!");
    } catch (error) {
        console.error("Erro ao fazer logout:", error);
        showMessage("Erro", "Não foi possível fazer logout. Tente novamente.");
    }
}

window.openAddProductModal = function () {
    addProductModal.style.display = "flex";
    uploadedImageUrlsAdd = [];
    draggedImagesPreviewAdd.innerHTML = "";
    document.getElementById("productTitle").value = "";
    document.getElementById("productDescription").value = "";
    document.getElementById("productImages").value = "";
    productCategorySelect.value = "";
}

window.closeAddProductModal = function () {
    addProductModal.style.display = "none";
    document.getElementById("productTitle").value = "";
    document.getElementById("productDescription").value = "";
    productPriceInput.value = "";
    document.getElementById("productImages").value = "";
    productCategorySelect.value = "";
    productCodeInput.value = "";
    uploadedImageUrlsAdd = [];
    draggedImagesPreviewAdd.innerHTML = "";
    uploadedImageFilesAdd = [];
}

window.openEditProductModal = function (item) {
    editingItemId = item.id;
    document.getElementById("editProductId").value = item.id;
    document.getElementById("editProductTitle").value = item.title;
    document.getElementById("editProductDescription").value = item.description;
    editProductPriceInput.value = item.price || "";
    editProductCodeInput.value = item.code || "";
    editProductCategorySelect.value = item.categoryId || "";

    document.getElementById("editProductImages").value = "";

    uploadedImageFilesEdit = [];
    uploadedImageUrlsEdit = [];
    draggedImagesPreviewEdit.innerHTML = "";

    if (item.images && item.images.length > 0) {
        item.images.forEach(imageUrl => {
            if (imageUrl.trim() !== "") {
                if (imageUrl.startsWith('https://firebasestorage.googleapis.com/')) {
                    uploadedImageUrlsEdit.push(imageUrl);

                    const imgPreview = document.createElement('img');
                    imgPreview.src = imageUrl;
                    const imgContainer = document.createElement('div');
                    imgContainer.style.position = 'relative';
                    imgContainer.style.display = 'inline-block';
                    imgContainer.appendChild(imgPreview);

                    const removeButton = document.createElement('span');
                    removeButton.innerHTML = '&times;';
                    removeButton.style.cssText = 'position: absolute; top: -5px; right: -5px; background: red; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; justify-content: center; align-items: center; cursor: pointer; font-size: 14px;';
                    removeButton.onclick = () => {
                        const index = uploadedImageUrlsEdit.indexOf(imageUrl);
                        if (index > -1) {
                            uploadedImageUrlsEdit.splice(index, 1);
                        }
                        imgContainer.remove();
                    };
                    imgContainer.appendChild(removeButton);

                    draggedImagesPreviewEdit.appendChild(imgContainer);
                }
            }
        });
    }

    editProductModal.style.display = "flex";
}

window.closeEditProductModal = function () {
    editProductModal.style.display = "none";
    editingItemId = null;
    document.getElementById("editProductId").value = "";
    document.getElementById("editProductTitle").value = "";
    editProductCodeInput.value = "";
    document.getElementById("editProductDescription").value = "";
    editProductPriceInput.value = "";
    document.getElementById("editProductImages").value = "";
    editProductCategorySelect.value = "";
    uploadedImageUrlsEdit = [];
    draggedImagesPreviewEdit.innerHTML = "";
    uploadedImageFilesAdd = [];
}

window.addProduct = async function () {
    const title = document.getElementById("productTitle").value;
    const description = document.getElementById("productDescription").value;
    const price = parseFloat(productPriceInput.value);
    const categoryId = productCategorySelect.value;
    const code = productCodeInput.value.trim();
    const textImages = document.getElementById("productImages").value.split(",").map(url => url.trim()).filter(url => url !== "");

    if (!title.trim()) {
        showMessage("Atenção", "O título do produto é obrigatório.");
        return;
    }

    addProductButton.disabled = true;
    addProductSpinner.style.display = 'inline-block';

    try {
        const uploadedUrls = [];
        for (const file of uploadedImageFilesAdd) {
            const storageRef = ref(storage, `product_images/${Date.now()}-${file.name}`);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);
            uploadedUrls.push(downloadURL);
        }

        const combinedImages = [...uploadedUrls, ...textImages];

        const itemsCollectionRef = collection(db, `artifacts/${appId}/public/data/items`);

        const newProduct = {
            title,
            code: code,
            description: description || "",
            price: isNaN(price) ? null : price,
            categoryId: categoryId || "",
            images: combinedImages,
            createdAt: new Date()
        };

        await addDoc(itemsCollectionRef, newProduct);

        showMessage("Sucesso", "Produto adicionado com sucesso!");
        closeAddProductModal();
    } catch (error) {
        console.error("Erro ao adicionar produto:", error);
        showMessage("Erro", "Não foi possível adicionar o produto. Verifique sua conexão ou tente novamente.");
    } finally {
        addProductButton.disabled = false;
        addProductSpinner.style.display = 'none';
    }
}

window.updateProduct = async function () {
    if (!editingItemId) {
        showMessage("Erro", "Nenhum produto selecionado para edição.");
        return;
    }

    const title = document.getElementById("editProductTitle").value;
    const description = document.getElementById("editProductDescription").value;
    const price = parseFloat(editProductPriceInput.value);
    const categoryId = editProductCategorySelect.value;
    const code = editProductCodeInput.value.trim();
    const textImages = document.getElementById("editProductImages").value.split(",").map(url => url.trim()).filter(url => url !== "");

    if (!title.trim()) {
        showMessage("Atenção", "O título do produto é obrigatório.");
        return;
    }

    try {
        const itemDocRef = doc(db, `artifacts/${appId}/public/data/items`, editingItemId);
        const currentItemData = items.find(item => item.id === editingItemId);
        const oldImages = currentItemData ? currentItemData.images || [] : [];

        const uploadedUrls = [];
        for (const file of uploadedImageFilesEdit) {
            const storageRef = ref(storage, `product_images/${Date.now()}-${file.name}`);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);
            uploadedUrls.push(downloadURL);
        }

        const finalImages = [...uploadedImageUrlsEdit, ...uploadedUrls, ...textImages];

        for (const oldUrl of oldImages) {
            if (!finalImages.includes(oldUrl) && oldUrl.startsWith('https://firebasestorage.googleapis.com/')) {
                try {
                    const pathStartIndex = oldUrl.indexOf('/o/') + 3;
                    const pathEndIndex = oldUrl.indexOf('?');
                    const storagePath = decodeURIComponent(oldUrl.substring(pathStartIndex, pathEndIndex));

                    const imageRef = ref(storage, storagePath);
                    await deleteObject(imageRef);
                    console.log(`Imagem ${oldUrl} removida do Storage.`);
                } catch (deleteError) {
                    console.warn(`Erro ao remover imagem do Storage (${oldUrl}):`, deleteError);
                }
            }
        }

        const updatedProduct = {
            title,
            code: code,
            description: description || "",
            price: isNaN(price) ? null : price,
            categoryId: categoryId || "",
            images: finalImages,
            updatedAt: new Date()
        };

        await updateDoc(itemDocRef, updatedProduct);

        showMessage("Sucesso", "Produto atualizado com sucesso!");
        closeEditProductModal();
    } catch (error) {
        console.error("Erro ao atualizar produto:", error);
        showMessage("Erro", "Não foi possível atualizar o produto. Verifique sua conexão ou tente novamente.");
    }
};

window.openImageCarouselModal = function (product) {
    currentProductInCarousel = product;
    currentCarouselImages = product.images;
    currentImageIndex = 0;

    carouselProductTitle.textContent = product.title;
    carouselProductDescription.textContent = product.description || "Sem descrição.";
    if (product.price !== undefined && product.price !== null) {
        carouselProductPrice.textContent = `R$ ${parseFloat(product.price).toFixed(2).replace('.', ',')}`;
    } else {
        carouselProductPrice.textContent = "Preço não disponível";
    }

    updateCarouselImage();
    imageCarouselModal.style.display = 'flex';

    carouselImage.addEventListener('touchstart', handleTouchStart, false);
    carouselImage.addEventListener('touchmove', handleTouchMove, false);
    carouselImage.addEventListener('touchend', handleTouchEnd, false);

    imageCarouselModal.addEventListener('click', handleCarouselModalOutsideClick);
};

window.closeImageCarouselModal = function () {
    imageCarouselModal.style.display = 'none';
    carouselImage.src = '';
    currentCarouselImages = [];
    currentImageIndex = 0;
    currentProductInCarousel = null;

    carouselProductTitle.textContent = "";
    carouselProductDescription.textContent = "";
    carouselProductPrice.textContent = "";
};

window.shareProductOnWhatsApp = function (name) {
    if (!currentProductInCarousel) {
        showMessage("Erro", "Nenhum produto selecionado para compartilhar.");
        return;
    }

    const productName = currentProductInCarousel.title;
    const productPrice = currentProductInCarousel.price !== undefined && currentProductInCarousel.price !== null
        ? ` por R$ ${parseFloat(currentProductInCarousel.price).toFixed(2).replace('.', ',')}`
        : "";
    const productCode = currentProductInCarousel.code && currentProductInCarousel.code.trim() !== ""
        ? ` (Cód: ${currentProductInCarousel.code})`
        : "";

    const whatsappNumber = name === 'leo' ? "5577988343473" : '5577981341126';

    let message = `Tenho interesse nesse produto: *${productName}${productCode}*${productPrice}!\n`;
    const pageLink = window.location.origin + window.location.pathname;
    message += `${pageLink}`;

    const whatsappUrl = `https://api.whatsapp.com/send?phone=${whatsappNumber}&text=${encodeURIComponent(message)}`;

    window.open(whatsappUrl, '_blank');
};

function updateCarouselDots() {
    const carouselDots = document.getElementById('carouselDots');
    carouselDots.innerHTML = '';

    if (currentCarouselImages.length > 1) {
        currentCarouselImages.forEach((_, index) => {
            const dot = document.createElement('span');
            dot.classList.add('carousel-dot');
            if (index === currentImageIndex) {
                dot.classList.add('active');
            }
            dot.onclick = () => {
                currentImageIndex = index;
                updateCarouselImage();
            };
            carouselDots.appendChild(dot);
        });
    }
}

window.openFullscreenImageModal = function (imageUrl) {
    if (imageUrl) {
        fullscreenImage.src = imageUrl;
        fullscreenImageModal.style.display = 'flex';
    }
};

window.closeFullscreenImageModal = function () {
    fullscreenImageModal.style.display = 'none';
    fullscreenImage.src = '';
};

function updateCarouselImage() {
    carouselImage.classList.remove('loaded');
    imageLoader.style.display = 'block';

    if (currentCarouselImages.length > 0) {
        const imgUrl = currentCarouselImages[currentImageIndex];
        carouselImage.src = imgUrl;
        carouselCounter.textContent = `${currentImageIndex + 1} / ${currentCarouselImages.length}`;

        carouselImage.onclick = () => {
            openFullscreenImageModal(imgUrl);
        };

        carouselImage.onload = () => {
            imageLoader.style.display = 'none';
            carouselImage.classList.add('loaded');
        };

        carouselImage.onerror = () => {
            imageLoader.style.display = 'none';
            carouselImage.src = `https://placehold.co/400x300/cccccc/ffffff?text=Imagem+Nao+Disponivel`;
            carouselImage.classList.add('loaded');
        };
    } else {
        imageLoader.style.display = 'none';
        carouselImage.src = `https://placehold.co/400x300/cccccc/ffffff?text=Sem+Imagens`;
        carouselImage.classList.add('loaded');
        carouselCounter.textContent = "0 / 0";
        carouselImage.onclick = null;
    }

    updateCarouselDots();
}

window.nextImage = function () {
    currentImageIndex = (currentImageIndex + 1) % currentCarouselImages.length;
    updateCarouselImage();
};

window.prevImage = function () {
    currentImageIndex = (currentImageIndex - 1 + currentCarouselImages.length) % currentCarouselImages.length;
    updateCarouselImage();
};

function handleTouchStart(evt) {
    touchStartX = evt.touches[0].clientX;
}

function handleTouchMove(evt) {
    const carouselNavOverlay = document.querySelector('.carousel-nav-overlay');
    if (carouselNavOverlay) {
        carouselNavOverlay.style.display = 'none';
    }
    if (!touchStartX) {
        return;
    }
    let touchEndX = evt.touches[0].clientX;
    let diffX = touchStartX - touchEndX;

    if (Math.abs(diffX) > 10) {
        evt.preventDefault();
    }
}

function handleTouchEnd(evt) {
    if (!touchStartX) {
        return;
    }
    let touchEndX = evt.changedTouches[0].clientX;
    let diffX = touchStartX - touchEndX;
    const swipeThreshold = 50;

    if (diffX > swipeThreshold) {
        nextImage();
    } else if (diffX < -swipeThreshold) {
        prevImage();
    }
    touchStartX = 0;
}

function handleCarouselModalOutsideClick(event) {
    if (event.target === imageCarouselModal) {
        closeImageCarouselModal();
    }
}


window.openAddCategoryModal = function () {
    addCategoryModal.style.display = "flex";
    document.getElementById("categoryName").value = "";
}

window.closeAddCategoryModal = function () {
    addCategoryModal.style.display = "none";
    document.getElementById("categoryName").value = "";
}

window.addCategory = async function () {
    const categoryName = document.getElementById("categoryName").value.trim();
    if (categoryName) {
        try {
            const categoriesCollectionRef = collection(db, `artifacts/${appId}/public/data/categories`);
            await addDoc(categoriesCollectionRef, { name: categoryName, createdAt: new Date() });
            showMessage("Sucesso", `Categoria "${categoryName}" adicionada com sucesso!`);
            closeAddCategoryModal();
        } catch (error) {
            console.error("Erro ao adicionar categoria:", error);
            showMessage("Erro", "Não foi possível adicionar a categoria. Tente novamente.");
        }
    } else {
        showMessage("Atenção", "Por favor, insira um nome para a categoria.");
    }
}

window.openManageCategoriesModal = function () {
    manageCategoryList.innerHTML = '';
    if (categories.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'Nenhuma categoria disponível.';
        li.className = 'text-center py-4 text-gray-400';
        manageCategoryList.appendChild(li);
    } else {
        const sortedCategories = [...categories].sort((a, b) => {
            const aName = a.name.toLowerCase();
            const bName = b.name.toLowerCase();
            const getIphoneSortValue = (name) => {
                if (name.includes('iphone')) {
                    if (name.includes('x') && !name.includes('xr')) return 10;
                    if (name.includes('xr')) return 10.5;
                    const match = name.match(/iphone\s*(\d+)/);
                    return match ? parseInt(match[1], 10) : 9999;
                }
                return Infinity;
            };
            const aIphoneVal = getIphoneSortValue(aName);
            const bIphoneVal = getIphoneSortValue(bName);

            if (aIphoneVal !== Infinity || bIphoneVal !== Infinity) {
                if (aIphoneVal !== bIphoneVal) {
                    return aIphoneVal - bIphoneVal;
                }
            }
            return aName.localeCompare(bName);
        });

        sortedCategories.forEach(category => {
            const li = document.createElement('li');
            li.className = 'category-list-item';
            li.innerHTML = `
                        <span>${category.name}</span>
                        <button class="delete-btn" onclick="showConfirmModal('Tem certeza que deseja remover a categoria &quot;${category.name}&quot;? Isso não removerá os produtos associados.', '${category.id}', 'category')">Remover</button>
                    `;
            manageCategoryList.appendChild(li);
        });
    }
    manageCategoriesModal.style.display = 'flex';
}

window.closeManageCategoriesModal = function () {
    manageCategoriesModal.style.display = 'none';
}

window.deleteProduct = async function (itemId) {
    if (!db) {
        console.warn("Firestore não disponível para remover item.");
        showMessage("Erro", "Serviço de base de dados não disponível.");
        return;
    }
    if (!storage) {
        console.warn("Firebase Storage não disponível para remover imagens.");
        showMessage("Aviso", "As imagens podem não ser removidas do Storage.");
    }

    try {
        const itemDocRef = doc(db, `artifacts/${appId}/public/data/items`, itemId);

        const itemSnapshot = await getDoc(itemDocRef);
        if (itemSnapshot.exists()) {
            const itemData = itemSnapshot.data();
            const imagesToDelete = itemData.images || [];

            for (const imageUrl of imagesToDelete) {
                if (imageUrl.startsWith('https://firebasestorage.googleapis.com/')) {
                    try {
                        const pathStartIndex = imageUrl.indexOf('/o/') + 3;
                        const pathEndIndex = imageUrl.indexOf('?');
                        const storagePath = decodeURIComponent(imageUrl.substring(pathStartIndex, pathEndIndex));

                        const imageRef = ref(storage, storagePath);
                        await deleteObject(imageRef);
                        console.log(`Imagem ${imageUrl} removida do Storage.`);
                    } catch (storageError) {
                        console.warn(`Erro ao remover imagem do Storage (${imageUrl}):`, storageError);
                    }
                }
            }
        }

        await deleteDoc(itemDocRef);
        showMessage("Sucesso", "Produto e imagens associadas removidos com sucesso!");
    } catch (error) {
        console.error("Erro ao remover produto:", error);
        showMessage("Erro", "Não foi possível remover o produto. Tente novamente.");
    }
};

window.deleteCategory = async function (categoryId) {
    if (!db) {
        console.warn("Firestore não disponível para remover categoria.");
        showMessage("Erro", "Serviço de base de dados não disponível.");
        return;
    }
    try {
        const categoryDocRef = doc(db, `artifacts/${appId}/public/data/categories`, categoryId);
        await deleteDoc(categoryDocRef);
        showMessage("Sucesso", "Categoria removida com sucesso!");
    } catch (error) {
        console.error("Erro ao remover categoria:", error);
        showMessage("Erro", "Não foi possível remover a categoria. Tente novamente.");
    }
};

dropAreaAdd.addEventListener('click', () => imageUploadAdd.click());
imageUploadAdd.addEventListener('change', (e) => handleFiles(e.target.files, uploadedImageFilesAdd, draggedImagesPreviewAdd));

dropAreaAdd.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropAreaAdd.classList.add('highlight');
});

dropAreaAdd.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropAreaAdd.classList.remove('highlight');
});

dropAreaAdd.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropAreaAdd.classList.remove('highlight');
    let dt = e.dataTransfer;
    let files = dt.files;
    handleFiles(files, uploadedImageFilesAdd, draggedImagesPreviewAdd);
});

dropAreaEdit.addEventListener('click', () => imageUploadEdit.click());
imageUploadEdit.addEventListener('change', (e) => handleFiles(e.target.files, uploadedImageFilesEdit, draggedImagesPreviewEdit));

dropAreaEdit.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropAreaEdit.classList.add('highlight');
});

dropAreaEdit.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropAreaEdit.classList.remove('highlight');
});

dropAreaEdit.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropAreaEdit.classList.remove('highlight');
    let dt = e.dataTransfer;
    let files = dt.files;
    handleFiles(files, uploadedImageFilesEdit, draggedImagesPreviewEdit);
});

function handleFiles(files, targetFilesArray, targetPreviewElement) {
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) {
            continue;
        }

        targetFilesArray.push(file);

        const reader = new FileReader();
        reader.onload = (e) => {
            const imageUrl = e.target.result;
            const imgPreview = document.createElement('img');
            imgPreview.src = imageUrl;
            const imgContainer = document.createElement('div');
            imgContainer.style.position = 'relative';
            imgContainer.style.display = 'inline-block';
            imgContainer.appendChild(imgPreview);

            const removeButton = document.createElement('span');
            removeButton.innerHTML = '&times;';
            removeButton.style.cssText = 'position: absolute; top: -5px; right: -5px; background: red; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; justify-content: center; align-items: center; cursor: pointer; font-size: 14px;';
            removeButton.onclick = () => {
                const index = targetFilesArray.indexOf(file);
                if (index > -1) {
                    targetFilesArray.splice(index, 1);
                }
                imgContainer.remove();
            };
            imgContainer.appendChild(removeButton);

            targetPreviewElement.appendChild(imgContainer);
        };
        reader.readAsDataURL(file);
    }
}

window.onload = initializeFirebase;