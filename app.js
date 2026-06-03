import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://jsbppxnrnzsxoqfworjj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_zLmaAY6WoAl8-fKy0WYMYw_RkvoueHC";
const COVER_BUCKET = "book-covers";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const elements = {
  form: document.querySelector("#bookForm"),
  formTitle: document.querySelector("#formTitle"),
  submitButton: document.querySelector("#bookForm button[type='submit']"),
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

let books = [];
let activeCoverPath = "";
let activeCoverUrl = "";
let selectedCoverFile = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
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

function setBusy(isBusy) {
  elements.submitButton.disabled = isBusy;
  elements.resetButton.disabled = isBusy;
  elements.submitButton.textContent = isBusy ? "保存中..." : "保存";
}

function setEmptyState(title, text) {
  elements.emptyState.innerHTML = `
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(text)}</p>
  `;
}

function updateCoverPreview(src) {
  elements.coverPreview.innerHTML = src
    ? `<img src="${src}" alt="封面预览" />`
    : "<span>暂无封面</span>";
}

function resetForm() {
  elements.form.reset();
  elements.bookId.value = "";
  elements.formTitle.textContent = "添加书籍";
  selectedCoverFile = null;
  activeCoverPath = "";
  activeCoverUrl = "";
  updateCoverPreview("");
}

async function loadBooks() {
  setEmptyState("正在加载阅读记录", "请稍等。");
  elements.emptyState.classList.add("is-visible");

  const { data, error } = await supabase
    .from("books")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    setEmptyState("加载失败", error.message);
    throw error;
  }

  books = data || [];
  renderBooks();
}

function getFilteredBooks() {
  const keyword = elements.searchInput.value.trim().toLowerCase();

  if (!keyword) {
    return books;
  }

  return books.filter((book) => {
    return [book.title, book.author, book.note, book.status].some((value) =>
      String(value ?? "").toLowerCase().includes(keyword),
    );
  });
}

function renderBooks() {
  const filteredBooks = getFilteredBooks();
  elements.bookCount.textContent = `共 ${books.length} 本书`;
  elements.emptyState.classList.toggle("is-visible", filteredBooks.length === 0);

  if (books.length === 0) {
    setEmptyState("还没有阅读记录", "从左侧添加第一本书开始。");
  } else if (filteredBooks.length === 0) {
    setEmptyState("没有匹配的书籍", "换个关键词再试试。");
  }

  elements.bookGrid.innerHTML = filteredBooks
    .map((book) => {
      const cover = book.cover_url
        ? `<img src="${book.cover_url}" alt="${escapeHtml(book.title)} 的封面" />`
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
  activeCoverPath = book.cover_path || "";
  activeCoverUrl = book.cover_url || "";
  selectedCoverFile = null;
  updateCoverPreview(book.cover_url);
  elements.title.focus();
}

async function removeCover(path) {
  if (!path) {
    return;
  }

  await supabase.storage.from(COVER_BUCKET).remove([path]);
}

function getCoverPath(file) {
  const extension = file.name.split(".").pop() || "jpg";
  const safeExtension = extension.toLowerCase().replace(/[^a-z0-9]/g, "");
  const id = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

  return `covers/${id}.${safeExtension}`;
}

async function uploadCover(file) {
  const path = getCoverPath(file);
  const { error } = await supabase.storage.from(COVER_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(COVER_BUCKET).getPublicUrl(path);

  return {
    path,
    url: data.publicUrl,
  };
}

async function deleteBook(id) {
  const book = books.find((item) => item.id === id);
  if (!book) {
    return;
  }

  const confirmed = window.confirm(`确定删除《${book.title}》吗？`);
  if (!confirmed) {
    return;
  }

  const { error } = await supabase.from("books").delete().eq("id", id);
  if (error) {
    window.alert(`删除失败：${error.message}`);
    return;
  }

  await removeCover(book.cover_path);

  if (elements.bookId.value === id) {
    resetForm();
  }

  books = books.filter((item) => item.id !== id);
  renderBooks();
}

elements.cover.addEventListener("change", (event) => {
  const [file] = event.target.files;

  if (!file) {
    return;
  }

  selectedCoverFile = file;
  updateCoverPreview(URL.createObjectURL(file));
});

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setBusy(true);

  try {
    let coverPath = activeCoverPath || null;
    let coverUrl = activeCoverUrl || null;

    if (selectedCoverFile) {
      const uploadedCover = await uploadCover(selectedCoverFile);
      coverPath = uploadedCover.path;
      coverUrl = uploadedCover.url;
    }

    const payload = {
      title: elements.title.value.trim(),
      author: elements.author.value.trim(),
      status: elements.status.value,
      cover_url: coverUrl,
      cover_path: coverPath,
      note: elements.note.value.trim(),
    };

    const id = elements.bookId.value;
    const request = id
      ? supabase.from("books").update(payload).eq("id", id)
      : supabase.from("books").insert(payload);

    const { error } = await request;
    if (error) {
      throw error;
    }

    if (selectedCoverFile && activeCoverPath && activeCoverPath !== coverPath) {
      await removeCover(activeCoverPath);
    }

    resetForm();
    await loadBooks();
  } catch (error) {
    window.alert(`保存失败：${error.message}`);
  } finally {
    setBusy(false);
  }
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

loadBooks();
