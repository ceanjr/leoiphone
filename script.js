// Variáveis globais para Firebase (AGORA DEFINIDAS MANUALMENTE PARA USO LOCAL)
// SUBSTITUA OS VALORES ABAIXO PELOS SEUS PRÓPRIOS, OBTIDOS DA SUA CONSOLA FIREBASE.
const firebaseConfig = {
    apiKey: "AIzaSyDrw18otUXUzzKPR2Q_jxAE2NqrvL4gj9I",
    authDomain: "leo-iphone-5c9a0.firebaseapp.com",
    projectId: "leo-iphone-5c9a0",
    storageBucket: "leo-iphone-5c9a0.firebasestorage.app",
    messagingSenderId: "484759088723",
    appId: "1:484759088723:web:7059fea6ebb48f1dcde0a6"
};

// Para uso local, o appId será o mesmo que o appId no seu firebaseConfig
const appId = firebaseConfig.appId;

// Para execução local, não temos um initialAuthToken.
// Vamos sempre tentar autenticar anonimamente.
const initialAuthToken = null;

// --- INÍCIO: DEBUGGING FIREBASE CONFIG ---
console.log("Configuração Firebase em uso (Local):", firebaseConfig);
console.log("Token de autenticação inicial (Local):", initialAuthToken);
console.log("App ID em uso (Local):", appId);
// --- FIM: DEBUGGING FIREBASE CONFIG ---

// Importações do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
// NOVO: Importações para Firebase Storage
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

let app;
let db;
let auth;
let storage;
let userId = null;
let items = []; // Array para armazenar os itens (será populado pelo Firestore)
let categories = []; // Novo array para armazenar as categorias
let uploadedImageUrlsAdd = []; // Armazena URLs de imagens para o modal de adição
let uploadedImageUrlsEdit = []; // Armazena URLs de imagens para o modal de edição
let editingItemId = null; // Armazena o ID do item a ser editado
let itemToDeleteId = null; // Armazena o ID do item a ser excluído
let currentFilterCategory = 'all'; // Categoria selecionada no filtro (default: 'all')
let uploadedImageFilesAdd = []; // NOVO: Armazena objetos File para o modal de adição
let uploadedImageFilesEdit = []; // NOVO: Armazena objetos File para o modal de edição

// Variáveis para o Carrossel
let currentCarouselImages = [];
let currentImageIndex = 0;
let currentProductInCarousel = null; // Armazena o objeto do produto atual no carrossel
let touchStartX = 0; // Para funcionalidade de swipe


// Inicializa o Firebase e autentica o utilizador
async function initializeFirebase() {
    try {
        // Verifica se firebaseConfig está vazio ou incompleto
        if (!firebaseConfig || Object.keys(firebaseConfig).length === 0 || !firebaseConfig.projectId) {
            console.error("Firebase Config está vazio ou incompleto. Certifique-se de que preencheu as suas credenciais.");
            showMessage("Erro de Configuração", "As credenciais do Firebase não foram carregadas corretamente. Verifique o seu código.");
            return; // Sai da função se a configuração for inválida
        }

        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        storage = getStorage(app);

        // Para uso local, sempre tentamos autenticar anonimamente, pois não há um token inicial do Canvas.
        await signInAnonymously(auth);

        // Observa mudanças no estado de autenticação
        onAuthStateChanged(auth, (user) => {
            if (user) {
                userId = user.uid;
                console.log("Utilizador autenticado:", userId);
                // Carrega os itens e categorias do Firestore após a autenticação
                loadCategoriesFromFirestore(); // Carrega categorias primeiro
                loadItemsFromFirestore(); // Depois carrega itens
                updateAuthUI(true); // Atualiza a UI para logado
            } else {
                userId = null;
                console.log("Nenhum utilizador autenticado.");
                updateAuthUI(false); // Atualiza a UI para deslogado
            }
        });
    } catch (error) {
        console.error("Erro ao inicializar Firebase ou autenticar:", error);
        showMessage("Erro", "Falha ao conectar ao serviço de autenticação. Tente novamente.");
    }
}

// Carrega as categorias do Firestore
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
            populateCategoryDropdowns(); // Popula os dropdowns após carregar
            renderItems(); // Re-renderiza para aplicar filtro se já houver um
        }, (error) => {
            console.error("Erro ao carregar categorias do Firestore:", error);
            showMessage("Erro", "Não foi possível carregar as categorias.");
        });
    } catch (error) {
        console.error("Erro ao carregar categorias do Firestore:", error);
        showMessage("Erro", "Não foi possível carregar as categorias.");
    }
}

// Carrega os itens do Firestore
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
            renderItems(); // Renderiza os itens na UI
        }, (error) => {
            console.error("Erro ao carregar itens do Firestore:", error);
            showMessage("Erro", "Não foi possível carregar os itens.");
        });

    } catch (error) {
        console.error("Erro ao carregar itens do Firestore:", error);
        showMessage("Erro", "Não foi possível carregar os itens.");
    }
}

// Elementos do DOM
const itemList = document.getElementById("itemList");
const itemModal = document.getElementById("itemModal"); // Modal de detalhes
const modalTitle = document.getElementById("modalTitle");
const productPriceInput = document.getElementById("productPrice");
const editProductPriceInput = document.getElementById("editProductPrice");
const modalDescription = document.getElementById("modalDescription");
const modalGallery = document.getElementById("modalGallery");
const authButton = document.getElementById("authButton");
const createProductButton = document.getElementById("createProductButton");
const createCategoryButton = document.getElementById("createCategoryButton"); // Novo botão
const manageCategoriesButton = document.getElementById("manageCategoriesButton"); // Novo botão
const messageModal = document.getElementById("messageModal");
const messageModalTitle = document.getElementById("messageModalTitle");
const messageModalText = document.getElementById("messageModalText");
const addProductModal = document.getElementById("addProductModal");
const addProductButton = document.getElementById('addProductButton'); // NOVA LINHA
const addProductSpinner = document.getElementById('addProductSpinner'); // NOVA LINHA
const editProductModal = document.getElementById("editProductModal");
const loginModal = document.getElementById("loginModal");
const addCategoryModal = document.getElementById("addCategoryModal"); // Novo modal de categoria
const manageCategoriesModal = document.getElementById("manageCategoriesModal"); // Novo modal de gerir categorias
const manageCategoryList = document.getElementById("manageCategoryList"); // Lista dentro do modal de gerir categorias
const imageCarouselModal = document.getElementById('imageCarouselModal'); // Novo modal de carrossel
const carouselImage = document.getElementById('carouselImage');
const carouselCounter = document.getElementById('carouselCounter');
const imageLoader = document.getElementById('imageLoader'); // NOVA LINHA
const carouselProductTitle = document.getElementById('carouselProductTitle');
const carouselProductDescription = document.getElementById('carouselProductDescription');
const carouselProductPrice = document.getElementById('carouselProductPrice');
const productCategorySelect = document.getElementById('productCategory'); // Select de categoria no modal de adicionar
const editProductCategorySelect = document.getElementById('editProductCategory'); // Select de categoria no modal de editar
const categoryFilterDropdown = document.getElementById('categoryFilter'); // Select de filtro de categoria
const confirmModal = document.getElementById('confirmModal'); // Modal de confirmação
const confirmModalText = document.getElementById('confirmModalText');

// Drag and drop elements for Add Product Modal
const dropAreaAdd = document.getElementById('dropAreaAdd');
const imageUploadAdd = document.getElementById('imageUploadAdd');
const draggedImagesPreviewAdd = document.getElementById('draggedImagesPreviewAdd');

// Drag and drop elements for Edit Product Modal
const dropAreaEdit = document.getElementById('dropAreaEdit');
const imageUploadEdit = document.getElementById('imageUploadEdit');
const draggedImagesPreviewEdit = document.getElementById('draggedImagesPreviewEdit');

const adminToken = "050990"; // Token para simular autenticação de admin (frontend)

// Funções Globais (expostas ao window para onclick)
window.showMessage = function (title, message) {
    messageModalTitle.textContent = title;
    messageModalText.textContent = message;
    messageModal.style.display = "flex";
}

window.closeMessageModal = function () {
    messageModal.style.display = "none";
}

// Funções para o modal de confirmação
window.showConfirmModal = function (message, itemId, type = 'product') { // Adicionado 'type' para diferenciar
    confirmModalTitle.textContent = `Confirmar Exclusão de ${type === 'product' ? 'Produto' : 'Categoria'}`;
    confirmModalText.textContent = message;
    itemToDeleteId = itemId; // Armazena o ID do item/categoria a ser excluído
    confirmModal.dataset.deleteType = type; // Armazena o tipo de exclusão
    confirmModal.style.display = 'flex';
}

window.closeConfirmModal = function () {
    confirmModal.style.display = 'none';
    itemToDeleteId = null; // Limpa o ID
    confirmModal.dataset.deleteType = ''; // Limpa o tipo
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
        createProductButton.style.display = "block"; // Mostra o botão "Criar Novo Produto"
        createCategoryButton.style.display = "block"; // Mostra o botão "Criar Categoria"
        manageCategoriesButton.style.display = "block"; // Mostra o botão "Gerir Categorias"
    } else {
        authButton.textContent = "Login";
        authButton.classList.remove('logout-btn');
        authButton.classList.add('login-btn');
        createProductButton.style.display = "none"; // Esconde o botão "Criar Novo Produto"
        createCategoryButton.style.display = "none"; // Esconde o botão "Criar Categoria"
        manageCategoriesButton.style.display = "none"; // Esconde o botão "Gerir Categorias"
        localStorage.removeItem("adminAuthenticated"); // Garante que o estado seja limpo
    }
    renderItems(); // Re-renderiza os itens para mostrar/esconder os botões de edição
}

window.toggleAuth = function () {
    if (authButton.textContent === "Login") {
        openLoginModal();
    } else {
        logout();
    }
}

// Popula os dropdowns de categoria
function populateCategoryDropdowns() {
    // Limpa os dropdowns
    productCategorySelect.innerHTML = '<option value="">Selecione uma categoria</option>';
    editProductCategorySelect.innerHTML = '<option value="">Selecione uma categoria</option>';
    categoryFilterDropdown.innerHTML = '<option value="all">Tudo</option>';

    // Ordena as categorias
    const sortedCategories = [...categories].sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();

        const getIphoneSortValue = (name) => {
            if (name.includes('iphone')) {
                if (name.includes('x') && !name.includes('xr')) return 10; // iPhone X
                if (name.includes('xr')) return 10.5; // iPhone XR
                const match = name.match(/iphone\s*(\d+)/);
                return match ? parseInt(match[1], 10) : 9999; // Grande número para iPhones sem número claro
            }
            return Infinity; // Não-iPhones vêm depois
        };

        const aIphoneVal = getIphoneSortValue(aName);
        const bIphoneVal = getIphoneSortValue(bName);

        // Se ambos são iPhones ou ambos não são iPhones, use a ordem alfabética como desempate
        if (aIphoneVal !== Infinity || bIphoneVal !== Infinity) {
            if (aIphoneVal !== bIphoneVal) {
                return aIphoneVal - bIphoneVal;
            }
        }

        // Fallback para ordenação alfabética para todos os outros casos
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

    // Restaura a seleção do filtro
    categoryFilterDropdown.value = currentFilterCategory;
}

// Filtra os produtos por categoria
window.filterProductsByCategory = function () {
    currentFilterCategory = categoryFilterDropdown.value;
    renderItems();
}

// Custom sort function for items
function sortItemsCustom(a, b) {
    const aTitle = a.title.toLowerCase();
    const bTitle = b.title.toLowerCase();

    const getIphoneSortValue = (title) => {
        if (title.includes('iphone')) {
            if (title.includes('x') && !title.includes('xr')) return 10; // iPhone X
            if (title.includes('xr')) return 10.5; // iPhone XR
            const match = title.match(/iphone\s*(\d+)/);
            return match ? parseInt(match[1], 10) : 9999; // Grande número para iPhones sem número claro
        }
        return Infinity; // Não-iPhones vêm depois
    };

    const aIphoneVal = getIphoneSortValue(aTitle);
    const bIphoneVal = getIphoneSortValue(bTitle);

    // Se ambos são iPhones ou ambos não são iPhones, use a ordem alfabética como desempate
    if (aIphoneVal !== Infinity || bIphoneVal !== Infinity) {
        if (aIphoneVal !== bIphoneVal) {
            return aIphoneVal - bIphoneVal;
        }
    }

    // Fallback para ordenação alfabética para todos os outros casos
    return aTitle.localeCompare(bTitle);
}

// Custom sort function for categories in the display list
function sortCategoriesForDisplay(a, b) {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();

    const getIphoneSortValue = (name) => {
        if (name.includes('iphone')) {
            if (name.includes('x') && !name.includes('xr')) return 10; // iPhone X
            if (name.includes('xr')) return 10.5; // iPhone XR
            const match = name.match(/iphone\s*(\d+)/);
            return match ? parseInt(match[1], 10) : 9999; // Grande número para iPhones sem número claro
        }
        return Infinity; // Não-iPhones vêm depois
    };

    // Rule 1: 'Sem Categoria' always comes last
    if (a.id === 'no-category') return 1;
    if (b.id === 'no-category') return -1;

    const aIphoneVal = getIphoneSortValue(aName);
    const bIphoneVal = getIphoneSortValue(bName);

    // Se ambos são iPhones ou ambos não são iPhones, use a ordem alfabética como desempate
    if (aIphoneVal !== Infinity || bIphoneVal !== Infinity) {
        if (aIphoneVal !== bIphoneVal) {
            return aIphoneVal - bIphoneVal;
        }
    }

    // Fallback para ordenação alfabética para todos os outros casos
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

                const itemDescription = document.createElement("div");
                itemDescription.textContent = item.description;
                itemDescription.className = "item-description";
                itemContent.appendChild(itemDescription);

                // NOVO: Exibir Preço
                if (item.price !== undefined && item.price !== null) {
                    const itemPrice = document.createElement("div");
                    itemPrice.textContent = `R$ ${parseFloat(item.price).toFixed(2).replace('.', ',')}`; // Formato monetário BR
                    itemPrice.className = "item-price text-lg font-semibold text-gold-400 mt-1"; // Adicione um estilo apropriado para o preço
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

window.openModal = function (item) { /* Este modal de detalhes não é mais chamado diretamente ao clicar no item. Pode ser removido se não for mais usado. */
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
        await auth.signOut(); // Desloga do Firebase
        localStorage.removeItem("adminAuthenticated"); // Remove o estado de admin local
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
    productCategorySelect.value = ""; // Limpa a seleção da categoria
}

window.closeAddProductModal = function () {
    addProductModal.style.display = "none";
    document.getElementById("productTitle").value = "";
    document.getElementById("productDescription").value = "";
    productPriceInput.value = ""; // Limpa o campo de preço
    document.getElementById("productImages").value = "";
    productCategorySelect.value = "";
    uploadedImageUrlsAdd = [];
    draggedImagesPreviewAdd.innerHTML = "";
    uploadedImageFilesAdd = []; // Limpa os arquivos
}

window.openEditProductModal = function (item) {
    editingItemId = item.id;
    document.getElementById("editProductId").value = item.id;
    document.getElementById("editProductTitle").value = item.title;
    document.getElementById("editProductDescription").value = item.description;
    editProductPriceInput.value = item.price || "";
    editProductCategorySelect.value = item.categoryId || "";

    // REMOVA ESTA LINHA:
    // document.getElementById("editProductImages").value = item.images.filter(url => !url.startsWith('data:image')).join(', ');
    // ADICIONE ESTA LINHA PARA GARANTIR QUE O CAMPO DE TEXTO FIQUE VAZIO PARA NOVAS ENTRADAS MANUAIS:
    document.getElementById("editProductImages").value = "";

    // Limpa as arrays de arquivos e URLs antigas para evitar duplicação
    uploadedImageFilesEdit = []; // Garante que a array de File's esteja vazia para novas uploads
    uploadedImageUrlsEdit = []; // Limpa as URLs existentes antes de repopular
    draggedImagesPreviewEdit.innerHTML = ""; // Limpa as pré-visualizações

    // NOVO: Renderiza as imagens existentes no preview do modal de edição
    if (item.images && item.images.length > 0) {
        item.images.forEach(imageUrl => {
            // Verifica se a URL é de uma imagem válida (não uma string vazia)
            if (imageUrl.trim() !== "") {
                // Adiciona a URL diretamente para a array de URLs que serão salvas
                // Apenas URLs do Firebase Storage serão gerenciadas pelos botões de remoção
                if (imageUrl.startsWith('https://firebasestorage.googleapis.com/')) {
                    uploadedImageUrlsEdit.push(imageUrl); // Mantém as URLs existentes na array de URLs

                    const imgPreview = document.createElement('img');
                    imgPreview.src = imageUrl;
                    // Adicionar um botão para remover a pré-visualização e a URL
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
                            uploadedImageUrlsEdit.splice(index, 1); // Remove a URL da array
                        }
                        imgContainer.remove(); // Remove a pré-visualização do DOM
                    };
                    imgContainer.appendChild(removeButton);

                    draggedImagesPreviewEdit.appendChild(imgContainer);
                } else {
                    // Se for uma URL que não é do Firebase Storage (ex: externa),
                    // você pode decidir como quer tratá-la.
                    // Para esta correção, assumimos que o campo de texto é para NOVAS URLs manuais.
                    // Se quiser que URLs externas existentes apareçam no campo de texto,
                    // adicione-as aqui:
                    // document.getElementById("editProductImages").value += (document.getElementById("editProductImages").value ? ", " : "") + imageUrl;
                    // No entanto, isso pode reintroduzir o problema de duplicação se o usuário não for cuidadoso.
                    // A abordagem mais limpa é que o campo de texto seja apenas para novas adições.
                }
            }
        });
    }

    editProductModal.style.display = "flex";
}

// ... (o restante do seu código, incluindo updateProduct, permanece o mesmo) ...

window.closeEditProductModal = function () {
    editProductModal.style.display = "none";
    editingItemId = null;
    document.getElementById("editProductId").value = "";
    document.getElementById("editProductTitle").value = "";
    document.getElementById("editProductDescription").value = "";
    editProductPriceInput.value = ""; // Limpa o campo de preço
    document.getElementById("editProductImages").value = "";
    editProductCategorySelect.value = "";
    uploadedImageUrlsEdit = [];
    draggedImagesPreviewEdit.innerHTML = "";
    uploadedImageFilesAdd = []; // Limpa os arquivos
}

window.addProduct = async function () {
    const title = document.getElementById("productTitle").value;
    const description = document.getElementById("productDescription").value;
    const price = parseFloat(productPriceInput.value);
    const categoryId = productCategorySelect.value;
    const textImages = document.getElementById("productImages").value.split(",").map(url => url.trim()).filter(url => url !== "");

    if (!title.trim()) {
        showMessage("Atenção", "O título do produto é obrigatório.");
        return;
    }

    // --- INÍCIO: Adicionar Loader ---
    addProductButton.disabled = true; // Desabilita o botão
    addProductSpinner.style.display = 'inline-block'; // Mostra o spinner
    // --- FIM: Adicionar Loader ---

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
        // --- INÍCIO: Remover Loader (sempre executa) ---
        addProductButton.disabled = false; // Habilita o botão
        addProductSpinner.style.display = 'none'; // Esconde o spinner
        // --- FIM: Remover Loader ---
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
        // Processar novos arquivos arrastados/selecionados
        for (const file of uploadedImageFilesEdit) {
            const storageRef = ref(storage, `product_images/${Date.now()}-${file.name}`);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);
            uploadedUrls.push(downloadURL);
        }

        // ***** CORREÇÃO AQUI: Combinar as URLs mantidas (uploadedImageUrlsEdit), as novas carregadas (uploadedUrls) e as textuais (textImages) *****
        const finalImages = [...uploadedImageUrlsEdit, ...uploadedUrls, ...textImages];

        // Lógica para remover imagens antigas que NÃO estão mais na lista final
        for (const oldUrl of oldImages) {
            // Verifica se a imagem antiga não está na lista final E se é uma URL do Firebase Storage
            if (!finalImages.includes(oldUrl) && oldUrl.startsWith('https://firebasestorage.googleapis.com/')) {
                try {
                    // Extrair o caminho completo do Storage a partir da URL de download
                    // Ex: 'https://firebasestorage.googleapis.com/v0/b/project.appspot.com/o/product_images%2Ffile.jpg?alt=media...'
                    // Precisamos de 'product_images/file.jpg'
                    const pathStartIndex = oldUrl.indexOf('/o/') + 3;
                    const pathEndIndex = oldUrl.indexOf('?');
                    // Decodificar a URL para lidar com espaços e caracteres especiais
                    const storagePath = decodeURIComponent(oldUrl.substring(pathStartIndex, pathEndIndex));

                    const imageRef = ref(storage, storagePath);
                    await deleteObject(imageRef);
                    console.log(`Imagem ${oldUrl} removida do Storage.`);
                } catch (deleteError) {
                    console.warn(`Erro ao remover imagem do Storage (${oldUrl}):`, deleteError);
                    // Não impede a atualização do documento mesmo se a imagem não puder ser deletada
                }
            }
        }

        const updatedProduct = {
            title,
            description: description || "",
            price: isNaN(price) ? null : price,
            categoryId: categoryId || "",
            images: finalImages, // Use a lista de imagens FINAL
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

// Funções para o Carrossel de Imagens
window.openImageCarouselModal = function (product) {
    currentProductInCarousel = product; 
    currentCarouselImages = product.images;
    currentImageIndex = 0; 

    // NOVO: Preencher as informações do produto
    carouselProductTitle.textContent = product.title;
    carouselProductDescription.textContent = product.description || "Sem descrição."; // Fallback para descrição vazia
    if (product.price !== undefined && product.price !== null) {
        carouselProductPrice.textContent = `R$ ${parseFloat(product.price).toFixed(2).replace('.', ',')}`;
    } else {
        carouselProductPrice.textContent = "Preço não disponível";
    }

    updateCarouselImage(); // Já chama a função que atualiza a imagem e o contador
    imageCarouselModal.style.display = 'flex';

    // ... (event listeners de toque e clique fora) ...
};

window.closeImageCarouselModal = function () {
    imageCarouselModal.style.display = 'none';
    carouselImage.src = '';
    currentCarouselImages = [];
    currentImageIndex = 0;
    currentProductInCarousel = null;

    // NOVO: Limpar as informações do produto ao fechar
    carouselProductTitle.textContent = "";
    carouselProductDescription.textContent = "";
    carouselProductPrice.textContent = "";

    // ... (remover event listeners de toque e clique fora) ...
};

function updateCarouselDots() {
    const carouselDots = document.getElementById('carouselDots');
    carouselDots.innerHTML = ''; // Limpa os dots existentes

    if (currentCarouselImages.length > 1) { // Só mostra os dots se houver mais de 1 imagem
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

function updateCarouselImage() {
    carouselImage.classList.remove('loaded');
    imageLoader.style.display = 'block';

    if (currentCarouselImages.length > 0) {
        const imgUrl = currentCarouselImages[currentImageIndex];
        carouselImage.src = imgUrl;
        carouselCounter.textContent = `${currentImageIndex + 1} / ${currentCarouselImages.length}`;

        // Evento para esconder o loader quando a imagem carregar
        carouselImage.onload = () => {
            imageLoader.style.display = 'none';
            carouselImage.classList.add('loaded');
        };

        // Evento para esconder o loader se a imagem falhar
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
    }

    updateCarouselDots(); // Mantenha essa chamada para os indicadores de navegação
}

window.nextImage = function () {
    currentImageIndex = (currentImageIndex + 1) % currentCarouselImages.length;
    updateCarouselImage();
};

window.prevImage = function () {
    currentImageIndex = (currentImageIndex - 1 + currentCarouselImages.length) % currentCarouselImages.length;
    updateCarouselImage();
};

// Lógica de Swipe para Carrossel
function handleTouchStart(evt) {
    touchStartX = evt.touches[0].clientX;
}

function handleTouchMove(evt) {
    // Remove a overlay de navegação por clique nas laterais do carrossel
    const carouselNavOverlay = document.querySelector('.carousel-nav-overlay');
    if (carouselNavOverlay) {
        carouselNavOverlay.style.display = 'none';
    }
    if (!touchStartX) {
        return;
    }
    let touchEndX = evt.touches[0].clientX;
    let diffX = touchStartX - touchEndX;

    // Previne o scroll da página se for um swipe horizontal significativo
    if (Math.abs(diffX) > 10) { // Um pequeno limiar para evitar scroll acidental
        evt.preventDefault();
    }
}

function handleTouchEnd(evt) {
    if (!touchStartX) {
        return;
    }
    let touchEndX = evt.changedTouches[0].clientX;
    let diffX = touchStartX - touchEndX;
    const swipeThreshold = 50; // Distância mínima para considerar um swipe

    if (diffX > swipeThreshold) {
        // Swipe para a esquerda (próxima imagem)
        nextImage();
    } else if (diffX < -swipeThreshold) {
        // Swipe para a direita (imagem anterior)
        prevImage();
    }
    touchStartX = 0; // Resetar para o próximo toque
}

// Função para fechar o modal do carrossel ao clicar fora
function handleCarouselModalOutsideClick(event) {
    // Verifica se o clique foi diretamente no fundo do modal (e não no conteúdo)
    if (event.target === imageCarouselModal) {
        closeImageCarouselModal();
    }
}


// Funções para o Modal de Categoria
window.openAddCategoryModal = function () {
    addCategoryModal.style.display = "flex";
    document.getElementById("categoryName").value = ""; // Limpa o campo
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

// Funções para Gerir Categorias
window.openManageCategoriesModal = function () {
    manageCategoryList.innerHTML = ''; // Limpa a lista antes de popular
    if (categories.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'Nenhuma categoria disponível.';
        li.className = 'text-center py-4 text-gray-400';
        manageCategoryList.appendChild(li);
    } else {
        // Reutiliza a lógica de ordenação de categorias para exibição
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

// Função para remover um produto e suas imagens do Storage
window.deleteProduct = async function (itemId) {
    if (!db) {
        console.warn("Firestore não disponível para remover item.");
        showMessage("Erro", "Serviço de base de dados não disponível.");
        return;
    }
    if (!storage) { // Verifique se o storage está inicializado
        console.warn("Firebase Storage não disponível para remover imagens.");
        showMessage("Aviso", "As imagens podem não ser removidas do Storage.");
        // continue, mas avise o usuário
    }

    try {
        const itemDocRef = doc(db, `artifacts/${appId}/public/data/items`, itemId);

        // 1. Obter os dados do produto ANTES de deletá-lo do Firestore
        const itemSnapshot = await getDoc(itemDocRef); // Importar getDoc do Firestore
        if (itemSnapshot.exists()) {
            const itemData = itemSnapshot.data();
            const imagesToDelete = itemData.images || [];

            // 2. Iterar sobre as imagens e deletar do Storage
            for (const imageUrl of imagesToDelete) {
                // Verifique se é uma URL do Firebase Storage para evitar deletar URLs externas
                if (imageUrl.startsWith('https://firebasestorage.googleapis.com/')) {
                    try {
                        const imageRef = ref(storage, imageUrl);
                        await deleteObject(imageRef);
                        console.log(`Imagem ${imageUrl} removida do Storage.`);
                    } catch (storageError) {
                        console.warn(`Erro ao remover imagem do Storage (${imageUrl}):`, storageError);
                        // Você pode adicionar mais tratamento de erro aqui,
                        // mas não queremos que um erro de deleção de imagem impeça a deleção do documento.
                    }
                }
            }
        }

        // 3. Deletar o documento do Firestore
        await deleteDoc(itemDocRef);
        showMessage("Sucesso", "Produto e imagens associadas removidos com sucesso!");
    } catch (error) {
        console.error("Erro ao remover produto:", error);
        showMessage("Erro", "Não foi possível remover o produto. Tente novamente.");
    }
};

// Função para remover uma categoria (MOVIDA PARA CÁ E TORNADA GLOBAL)
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
}; // Note o ; aqui

// Lógica de Drag and Drop para Adicionar Produto
// Lógica de Drag and Drop para Adicionar Produto
dropAreaAdd.addEventListener('click', () => imageUploadAdd.click());
// Mude 'uploadedImageUrlsAdd' para 'uploadedImageFilesAdd'
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
    // Mude 'uploadedImageUrlsAdd' para 'uploadedImageFilesAdd'
    handleFiles(files, uploadedImageFilesAdd, draggedImagesPreviewAdd);
});

// Lógica de Drag and Drop para Editar Produto
dropAreaEdit.addEventListener('click', () => imageUploadEdit.click());
// Mude 'uploadedImageUrlsEdit' para 'uploadedImageFilesEdit'
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
    // Mude 'uploadedImageUrlsEdit' para 'uploadedImageFilesEdit'
    handleFiles(files, uploadedImageFilesEdit, draggedImagesPreviewEdit);
});

function handleFiles(files, targetFilesArray, targetPreviewElement) {
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) {
            continue;
        }

        // Armazena o objeto File diretamente na array
        targetFilesArray.push(file);

        // Cria a pré-visualização usando FileReader (Base64 temporário para exibição)
        const reader = new FileReader();
        reader.onload = (e) => {
            const imageUrl = e.target.result;
            const imgPreview = document.createElement('img');
            imgPreview.src = imageUrl;
            // Opcional: Adicionar um botão para remover a pré-visualização e o arquivo
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
                    targetFilesArray.splice(index, 1); // Remove o arquivo da array
                }
                imgContainer.remove(); // Remove a pré-visualização do DOM
            };
            imgContainer.appendChild(removeButton);

            targetPreviewElement.appendChild(imgContainer);
        };
        reader.readAsDataURL(file);
    }
}

// Inicializa o Firebase e carrega os itens ao carregar a página
window.onload = initializeFirebase;