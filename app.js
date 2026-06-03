const STORAGE_KEY = "reading-records.books";

const elements = {
  form: document.querySelector("#bookForm"),
  formTitle: document.querySelector("#formTitle"),
  bookId: document.querySelector("#bookId"),
  title: document.querySelector("#title"),
  author: document.querySelector("#author"),
  status: document.querySelector("#status"),
  cover: document.querySelector("#cover"),
  note: document.querySelector("#note"),
  coverPreview: document.querySelector("#coverPreview"),
  resetButton: document.querySelector("#resetButton"),
  newBookButton: document.querySelector("#newBookButton"),
  bookGrid: document.querySelector("#bookGrid"),
  emptyState: document.querySelector("#emptyState"),
  bookCount: document.querySelector("#bookCount"),
  searchInput: document.querySelector("#searchInput"),
};

let books = loadBooks();
let activeCover = "";

function loadBooks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveBooks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
}

function createId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return entities[char];
  });
}

function updateCoverPreview(src) {
  activeCover = src || "";
  elements.coverPreview.innerHTML = activeCover
    ? `<img src="${activeCover}" alt="封面预览" />`
    : "<span>暂无封面</span>";
}

function resetForm() {
  elements.form.reset();
  elements.bookId.value = "";
  elements.formTitle.textContent = "添加书籍";
  updateCoverPreview("");
}

function getFilteredBooks() {
  const keyword = elements.searchInput.value.trim().toLowerCase();

  if (!keyword) {
    return books;
  }

  return books.filter((book) => {
    return [book.title, book.author, book.note, book.status].some((value) =>
      value.toLowerCase().includes(keyword),
    );
  });
}

function renderBooks() {
  const filteredBooks = getFilteredBooks();
  elements.bookCount.textContent = `共 ${books.length} 本书`;
  elements.emptyState.classList.toggle("is-visible", filteredBooks.length === 0);

  elements.bookGrid.innerHTML = filteredBooks
    .map((book) => {
      const cover = book.cover
        ? `<img src="${book.cover}" alt="${escapeHtml(book.title)} 的封面" />`
        : `<span>${escapeHtml(book.title.slice(0, 8))}</span>`;
      const author = book.author || "未填写作者";
      const note = book.note || "还没有读书笔记。";

      return `
        <article class="book-card">
          <div class="book-cover">${cover}</div>
          <div class="book-body">
            <div class="book-meta">
              <h3 class="book-title">${escapeHtml(book.title)}</h3>
              <p class="book-author">${escapeHtml(author)}</p>
              <span class="status-pill">${escapeHtml(book.status)}</span>
            </div>
            <p class="book-note">${escapeHtml(note)}</p>
            <div class="card-actions">
              <button class="text-button" type="button" data-action="edit" data-id="${book.id}">修改</button>
              <button class="danger-button" type="button" data-action="delete" data-id="${book.id}">删除</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function editBook(id) {
  const book = books.find((item) => item.id === id);
  if (!book) {
    return;
  }

  elements.bookId.value = book.id;
  elements.title.value = book.title;
  elements.author.value = book.author;
  elements.status.value = book.status;
  elements.note.value = book.note;
  elements.formTitle.textContent = "修改书籍";
  updateCoverPreview(book.cover);
  elements.title.focus();
}

function deleteBook(id) {
  const book = books.find((item) => item.id === id);
  if (!book) {
    return;
  }

  const confirmed = window.confirm(`确定删除《${book.title}》吗？`);
  if (!confirmed) {
    return;
  }

  books = books.filter((item) => item.id !== id);
  saveBooks();

  if (elements.bookId.value === id) {
    resetForm();
  }

  renderBooks();
}

elements.cover.addEventListener("change", async (event) => {
  const [file] = event.target.files;

  if (!file) {
    return;
  }

  const imageData = await fileToDataUrl(file);
  updateCoverPreview(imageData);
});

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();

  const id = elements.bookId.value || createId();
  const nextBook = {
    id,
    title: elements.title.value.trim(),
    author: elements.author.value.trim(),
    status: elements.status.value,
    cover: activeCover,
    note: elements.note.value.trim(),
    updatedAt: new Date().toISOString(),
  };

  const existingIndex = books.findIndex((book) => book.id === id);
  if (existingIndex >= 0) {
    books[existingIndex] = nextBook;
  } else {
    books.unshift(nextBook);
  }

  saveBooks();
  resetForm();
  renderBooks();
});

elements.bookGrid.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const { action, id } = button.dataset;
  if (action === "edit") {
    editBook(id);
  }

  if (action === "delete") {
    deleteBook(id);
  }
});

elements.resetButton.addEventListener("click", resetForm);
elements.newBookButton.addEventListener("click", () => {
  resetForm();
  elements.title.focus();
});
elements.searchInput.addEventListener("input", renderBooks);

renderBooks();
