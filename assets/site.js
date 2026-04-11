const SITE_BASE_PATH = detectSiteBasePath();

document.addEventListener("DOMContentLoaded", () => {
  loadPersonalProfile();

  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  const blogList = document.getElementById("blog-list");
  if (blogList) {
    loadBlogPosts(blogList);
  }

  const projectList = document.getElementById("project-list");
  if (projectList) {
    loadProjects(projectList);
  }

  const aboutMarkdown = document.getElementById("about-markdown");
  if (aboutMarkdown) {
    loadAboutMarkdown(aboutMarkdown);
  }
});

async function loadAboutMarkdown(aboutContainer) {
  if (window.location.protocol === "file:") {
    aboutContainer.innerHTML = "<p>Local file mode detected. Markdown cannot be loaded through file:// due to browser security. Start a local server with <code>python -m http.server 8123</code> and open <code>http://localhost:8123/pages/about.html</code>.</p>";
    return;
  }

  try {
    const response = await fetch(toSitePath("about/about.md"));
    if (!response.ok) {
      throw new Error("Could not load about/about.md");
    }

    const markdown = await response.text();
    const parsed = parseMarkdownTagsAndClean(markdown);
    aboutContainer.innerHTML = renderMarkdown(parsed.markdown);
    applyAboutFormattingHooks(aboutContainer);
  } catch (error) {
    aboutContainer.innerHTML = "<p>About content could not be loaded right now. " + localFileHint() + "</p>";
    console.error(error);
  }
}

function applyAboutFormattingHooks(container) {
  if (!container) {
    return;
  }

  container.querySelectorAll("h1").forEach((el) => el.classList.add("about-h1"));
  container.querySelectorAll("h2").forEach((el) => el.classList.add("about-h2"));
  container.querySelectorAll("h3").forEach((el) => el.classList.add("about-h3"));
  container.querySelectorAll("p").forEach((el) => el.classList.add("about-p"));
  container.querySelectorAll("ul").forEach((el) => el.classList.add("about-ul"));
  container.querySelectorAll("ol").forEach((el) => el.classList.add("about-ol"));
  container.querySelectorAll("li").forEach((el) => el.classList.add("about-li"));
  container.querySelectorAll("a").forEach((el) => el.classList.add("about-link"));
  container.querySelectorAll("blockquote").forEach((el) => el.classList.add("about-blockquote"));
  container.querySelectorAll("pre").forEach((el) => el.classList.add("about-pre"));
  container.querySelectorAll("code").forEach((el) => el.classList.add("about-code"));
}

async function loadPersonalProfile() {
  try {
    const response = await fetch(toSitePath("profile.json"));
    if (!response.ok) {
      throw new Error("Could not load profile.json");
    }

    const profile = await response.json();
    applyPersonalProfile(profile || {});
  } catch (error) {
    console.warn("Profile data not applied:", error);
  }
}

function applyPersonalProfile(profile) {
  setProfileText("name", profile.name);
  setProfileMultilineText("headline", profile.headline);
  setProfileText("homeIntro", profile.homeIntro);
  setProfileText("quickIntro", profile.quickIntro);
  setProfileText("aboutText", profile.aboutText);
  setProfileText("contactIntro", profile.contactIntro);

  setProfileLink("emailLink", emailToHref(profile.contact && profile.contact.email), profile.contact && profile.contact.email);
  setProfileLink("githubLink", profile.contact && profile.contact.github, profile.contact && profile.contact.github);
  setProfileLink("linkedinLink", profile.contact && profile.contact.linkedin, profile.contact && profile.contact.linkedin);

  const cvHref = resolveProfileValuePath(profile.cv && profile.cv.file);
  document.querySelectorAll("[data-profile='cvLink']").forEach((el) => {
    if (cvHref) {
      el.setAttribute("href", cvHref);
      if (profile.cv && profile.cv.downloadName) {
        el.setAttribute("download", profile.cv.downloadName);
      }
    }
  });

  const skillsContainer = document.querySelector("[data-profile='skills']");
  if (skillsContainer && Array.isArray(profile.skills) && profile.skills.length > 0) {
    skillsContainer.innerHTML = profile.skills.map((skill) => {
      return "<span class=\"chip\">" + escapeHtml(String(skill)) + "</span>";
    }).join("");
  }
}

function setProfileText(key, value) {
  if (value === undefined || value === null) {
    return;
  }

  document.querySelectorAll("[data-profile='" + key + "']").forEach((el) => {
    el.textContent = String(value);
  });
}

function setProfileMultilineText(key, value) {
  if (value === undefined || value === null) {
    return;
  }

  const lines = Array.isArray(value)
    ? value.map((line) => String(line))
    : String(value).split(/\r?\n|::nl/g);

  const html = lines
    .filter((line) => line.trim() !== "")
    .map((line) => escapeHtml(line))
    .join("<br>");

  document.querySelectorAll("[data-profile='" + key + "']").forEach((el) => {
    el.innerHTML = html || escapeHtml(String(value));
  });
}

function setProfileLink(key, href, text) {
  if (!href) {
    return;
  }

  document.querySelectorAll("[data-profile='" + key + "']").forEach((el) => {
    el.setAttribute("href", href);
    if (text) {
      el.textContent = String(text);
    }
  });
}

function emailToHref(email) {
  if (!email) {
    return "";
  }

  return "mailto:" + email;
}

function resolveProfileValuePath(pathValue) {
  if (!pathValue || typeof pathValue !== "string") {
    return "";
  }

  const normalized = pathValue.replace(/\\/g, "/");
  if (/^(https?:|mailto:)/i.test(normalized)) {
    return normalized;
  }

  return toSitePath(normalized);
}

async function loadBlogPosts(blogList) {
  const blogSidebarList = document.getElementById("blog-sidebar-list");
  const blogSidebarGroups = document.getElementById("blog-sidebar-groups");
  const blogTagFilters = document.getElementById("blog-tag-filters");

  if (window.location.protocol === "file:") {
    blogList.innerHTML = "<article class=\"blog-item\"><p>Local file mode detected. Markdown cannot be loaded through file:// due to browser security. Start a local server with <code>python -m http.server 8123</code> in the repo root, then open <code>http://localhost:8123/pages/blog.html</code>.</p></article>";
    if (blogSidebarList) {
      blogSidebarList.innerHTML = "<li>Run local server to load index</li>";
    }
    return;
  }

  try {
    const manifestResponse = await fetch(toSitePath("blog/posts.json"));
    if (!manifestResponse.ok) {
      throw new Error("Could not load blog manifest.");
    }

    const posts = sortByDateDesc(await manifestResponse.json(), "date");
    if (!Array.isArray(posts) || posts.length === 0) {
      blogList.innerHTML = "<article class=\"blog-item\"><p>No posts yet. Add markdown files in /blog and list them in posts.json.</p></article>";
      if (blogSidebarList) {
        blogSidebarList.innerHTML = "<li>No posts yet</li>";
      }
      if (blogTagFilters) {
        blogTagFilters.innerHTML = "<span class=\"tag-filter-label\">Filter by tag:</span><span class=\"tag-filter-loading\">No tags yet</span>";
      }
      return;
    }

    const cards = await Promise.all(posts.map(async (post, index) => {
      const postPath = resolveBlogMarkdownPath(post.file);
      const postResponse = await fetch(postPath);
      if (!postResponse.ok) {
        throw new Error("Could not load post: " + postPath);
      }
      const markdown = await postResponse.text();
      const parsed = parseMarkdownTagsAndClean(markdown);
      return {
        id: buildItemId(post.title || "post", index),
        title: post.title,
        description: post.description || extractFirstParagraph(parsed.markdown),
        date: post.date,
        group: getFolderGroup(post.file, "blog"),
        tags: parsed.tags,
        postPath: postPath,
        html: renderMarkdown(parsed.markdown)
      };
    }));

    setupTagFiltering({
      items: cards,
      filterContainer: blogTagFilters,
      renderItems: (filteredItems) => {
        renderSidebarGrouped(filteredItems, blogSidebarGroups, blogSidebarList, (item) => ({
          id: item.id,
          title: item.title || "Untitled",
          description: item.description || "",
          date: item.date
        }));

        blogList.innerHTML = renderContentGroups(filteredItems, (card) => {
          return "<article id=\"" + card.id + "\" class=\"blog-item\">" +
            "<time datetime=\"" + safeDateValue(card.date) + "\">" + displayDate(card.date) + "</time>" +
            renderItemTags(card.tags) +
            "<div class=\"blog-content\">" + card.html + "</div>" +
            "<p><a href=\"content.html?file=" + encodeURIComponent(card.postPath) + "&title=" + encodeURIComponent(card.title) + "\">Open rendered post</a></p>" +
            "</article>";
        }, "No posts match this tag filter.");
      }
    });
  } catch (error) {
    blogList.innerHTML = "<article class=\"blog-item\"><p>Blog could not be loaded right now. " +
      localFileHint() + "</p></article>";
    console.error(error);
  }
}

async function loadProjects(projectList) {
  const projectSidebarList = document.getElementById("project-sidebar-list");
  const projectSidebarGroups = document.getElementById("project-sidebar-groups");
  const projectTagFilters = document.getElementById("project-tag-filters");

  if (window.location.protocol === "file:") {
    projectList.innerHTML = "<article class=\"blog-item\"><p>Local file mode detected. Markdown cannot be loaded through file:// due to browser security. Start a local server with <code>python -m http.server 8123</code> in the repo root, then open <code>http://localhost:8123/pages/projects.html</code>.</p></article>";
    if (projectSidebarList) {
      projectSidebarList.innerHTML = "<li>Run local server to load index</li>";
    }
    return;
  }

  try {
    const manifestResponse = await fetch(toSitePath("projects/projects.json"));
    if (!manifestResponse.ok) {
      throw new Error("Could not load projects manifest.");
    }

    const projects = sortByDateDesc(await manifestResponse.json(), "date");
    if (!Array.isArray(projects) || projects.length === 0) {
      projectList.innerHTML = "<article class=\"blog-item\"><p>No projects yet. Add markdown files in /projects and list them in projects/projects.json.</p></article>";
      if (projectSidebarList) {
        projectSidebarList.innerHTML = "<li>No projects yet</li>";
      }
      if (projectTagFilters) {
        projectTagFilters.innerHTML = "<span class=\"tag-filter-label\">Filter by tag:</span><span class=\"tag-filter-loading\">No tags yet</span>";
      }
      return;
    }

    const cards = await Promise.all(projects.map(async (project, index) => {
      const markdownPath = resolveProjectMarkdownPath(project.markdown);
      const markdownResponse = await fetch(markdownPath);
      if (!markdownResponse.ok) {
        throw new Error("Could not load project markdown: " + markdownPath);
      }

      const markdown = await markdownResponse.text();
      const parsed = parseMarkdownTagsAndClean(markdown);
      return {
        id: buildItemId(project.name || "project", index),
        name: project.name || "Untitled Project",
        date: project.date || "",
        description: project.description || extractFirstParagraph(parsed.markdown),
        group: getFolderGroup(project.markdown, "projects"),
        tags: parsed.tags,
        markdownPath: markdownPath,
        html: renderMarkdown(parsed.markdown)
      };
    }));

    setupTagFiltering({
      items: cards,
      filterContainer: projectTagFilters,
      renderItems: (filteredItems) => {
        renderSidebarGrouped(filteredItems, projectSidebarGroups, projectSidebarList, (item) => ({
          id: item.id,
          title: item.name,
          description: item.description || "",
          date: item.date
        }));

        projectList.innerHTML = renderContentGroups(filteredItems, (card) => {
          return "<article id=\"" + card.id + "\" class=\"blog-item\">" +
            "<time datetime=\"" + safeDateValue(card.date) + "\">" + displayDate(card.date) + "</time>" +
            renderItemTags(card.tags) +
            "<div class=\"blog-content\">" + card.html + "</div>" +
            "<p><a href=\"content.html?file=" + encodeURIComponent(card.markdownPath) + "&title=" + encodeURIComponent(card.name) + "\">Open rendered project</a></p>" +
            "</article>";
        }, "No projects match this tag filter.");
      }
    });
  } catch (error) {
    projectList.innerHTML = "<article class=\"blog-item\"><p>Projects could not be loaded right now. " +
      localFileHint() + "</p></article>";
    console.error(error);
  }
}

function resolveProjectMarkdownPath(pathValue) {
  if (!pathValue || typeof pathValue !== "string") {
    throw new Error("Invalid markdown path in projects manifest.");
  }

  const normalized = pathValue.replace(/\\/g, "/");

  if (normalized.startsWith("projects/")) {
    return toSitePath(normalized);
  }

  return toSitePath("projects/" + normalized);
}

function resolveBlogMarkdownPath(pathValue) {
  if (!pathValue || typeof pathValue !== "string") {
    throw new Error("Invalid markdown path in blog manifest.");
  }

  const normalized = pathValue.replace(/\\/g, "/");

  if (normalized.startsWith("blog/")) {
    return toSitePath(normalized);
  }

  return toSitePath("blog/" + normalized);
}

function toSitePath(relativePath) {
  const normalized = String(relativePath || "").replace(/\\/g, "/");
  const base = SITE_BASE_PATH.endsWith("/") ? SITE_BASE_PATH : SITE_BASE_PATH + "/";
  return new URL(base + normalized, window.location.origin).href;
}

function detectSiteBasePath() {
  const scripts = Array.from(document.getElementsByTagName("script"));
  const siteScript = scripts.find((script) => {
    const src = script.getAttribute("src") || "";
    return src.includes("assets/site.js");
  });

  if (siteScript && siteScript.src) {
    const scriptUrl = new URL(siteScript.src, window.location.href);
    return scriptUrl.pathname.replace(/\/assets\/site\.js$/, "") || "/";
  }

  if (window.location.pathname.includes("/pages/")) {
    return window.location.pathname.replace(/\/pages\/.+$/, "") || "/";
  }

  return "/";
}

function localFileHint() {
  if (window.location.protocol === "file:") {
    return "When opened via file://, browsers block JSON/Markdown fetch requests. Use GitHub Pages or run a local server (for example: python -m http.server).";
  }

  return "Please check your JSON and markdown paths.";
}

function sortByDateDesc(items, dateKey) {
  if (!Array.isArray(items)) {
    return [];
  }

  return [...items].sort((a, b) => {
    const aDate = Date.parse(a && a[dateKey] ? a[dateKey] : "");
    const bDate = Date.parse(b && b[dateKey] ? b[dateKey] : "");

    const aValid = Number.isFinite(aDate);
    const bValid = Number.isFinite(bDate);

    if (aValid && bValid) {
      return bDate - aDate;
    }
    if (aValid) {
      return -1;
    }
    if (bValid) {
      return 1;
    }
    return 0;
  });
}

function displayDate(dateValue) {
  const parsed = Date.parse(dateValue || "");
  if (!Number.isFinite(parsed)) {
    return "No date";
  }

  return new Date(parsed).toISOString().slice(0, 10);
}

function safeDateValue(dateValue) {
  const parsed = Date.parse(dateValue || "");
  if (!Number.isFinite(parsed)) {
    return "";
  }

  return new Date(parsed).toISOString().slice(0, 10);
}

function buildItemId(text, index) {
  const base = String(text || "item")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 50);

  return (base || "item") + "-" + (index + 1);
}

function getFolderGroup(pathValue, rootFolder) {
  const normalized = String(pathValue || "").replace(/\\/g, "/").replace(/^\.\//, "");
  const withoutRoot = normalized.startsWith(rootFolder + "/")
    ? normalized.slice(rootFolder.length + 1)
    : normalized;
  const parts = withoutRoot.split("/");

  if (parts.length <= 1) {
    return "root";
  }

  return parts.slice(0, -1).join("/");
}

function parseMarkdownTagsAndClean(markdown) {
  const tagSet = new Set();
  const lines = String(markdown || "").split(/\r?\n/);
  const cleanedLines = [];
  let inCodeFence = false;

  lines.forEach((line) => {
    if (line.trimStart().startsWith("```")) {
      inCodeFence = !inCodeFence;
      cleanedLines.push(line);
      return;
    }

    if (inCodeFence) {
      cleanedLines.push(line);
      return;
    }

    const cleaned = line.replace(/(^|[\s(])#([A-Za-z0-9_-]+)\b/g, (full, prefix, rawTag) => {
      const tag = (rawTag || "").toLowerCase();
      if (tag) {
        tagSet.add(tag);
      }
      return prefix;
    });

    cleanedLines.push(cleaned.replace(/[ \t]{2,}/g, " ").trimEnd());
  });

  return {
    tags: Array.from(tagSet).sort(),
    markdown: cleanedLines.join("\n")
  };
}

function setupTagFiltering(options) {
  const items = Array.isArray(options.items) ? options.items : [];
  const filterContainer = options.filterContainer;
  const renderItems = options.renderItems;
  const allTags = sortedUniqueTags(items);
  let selectedTag = "all";

  if (filterContainer) {
    filterContainer.innerHTML = "<span class=\"tag-filter-label\">Filter by tag:</span>";
    const allButton = createTagButton("all", "All", true, (nextTag) => {
      selectedTag = nextTag;
      updateActiveTagButton(filterContainer, selectedTag);
      renderCurrent();
    });
    filterContainer.appendChild(allButton);

    allTags.forEach((tag) => {
      const btn = createTagButton(tag, "#" + tag, false, (nextTag) => {
        selectedTag = nextTag;
        updateActiveTagButton(filterContainer, selectedTag);
        renderCurrent();
      });
      filterContainer.appendChild(btn);
    });

    if (allTags.length === 0) {
      const hint = document.createElement("span");
      hint.className = "tag-filter-loading";
      hint.textContent = "No tags found";
      filterContainer.appendChild(hint);
    }
  }

  function renderCurrent() {
    const filtered = selectedTag === "all"
      ? items
      : items.filter((item) => Array.isArray(item.tags) && item.tags.includes(selectedTag));
    renderItems(filtered);
  }

  renderCurrent();
}

function createTagButton(value, label, isActive, onSelect) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "tag-filter-btn" + (isActive ? " active" : "");
  btn.dataset.tag = value;
  btn.textContent = label;
  btn.addEventListener("click", () => onSelect(value));
  return btn;
}

function updateActiveTagButton(container, selectedTag) {
  const buttons = container.querySelectorAll(".tag-filter-btn");
  buttons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tag === selectedTag);
  });
}

function sortedUniqueTags(items) {
  const tagSet = new Set();
  items.forEach((item) => {
    if (Array.isArray(item.tags)) {
      item.tags.forEach((tag) => tagSet.add(tag));
    }
  });
  return Array.from(tagSet).sort();
}

function groupItemsByFolder(items) {
  const grouped = new Map();

  items.forEach((item) => {
    const group = item.group || "root";
    if (!grouped.has(group)) {
      grouped.set(group, []);
    }
    grouped.get(group).push(item);
  });

  return Array.from(grouped.entries()).sort((a, b) => {
    if (a[0] === "root") {
      return -1;
    }
    if (b[0] === "root") {
      return 1;
    }
    return a[0].localeCompare(b[0]);
  });
}

function renderSidebarGrouped(items, sidebarGroupsEl, sidebarListEl, mapItem) {
  const grouped = groupItemsByFolder(items);

  if (!sidebarGroupsEl) {
    if (sidebarListEl) {
      sidebarListEl.innerHTML = items.map((item) => {
        const mapped = mapItem(item);
        return renderSidebarEntry(mapped);
      }).join("");
    }
    return;
  }

  if (items.length === 0) {
    sidebarGroupsEl.innerHTML = "<ul class=\"sidebar-list\"><li>No entries found</li></ul>";
    return;
  }

  sidebarGroupsEl.innerHTML = grouped.map(([groupName, groupItems]) => {
    return "<section>" +
      "<h3 class=\"sidebar-group-title\">" + humanizeGroupName(groupName) + "</h3>" +
      "<ul class=\"sidebar-list\">" +
      groupItems.map((item) => {
        const mapped = mapItem(item);
        return renderSidebarEntry(mapped);
      }).join("") +
      "</ul>" +
      "</section>";
  }).join("");
}

function renderSidebarEntry(mapped) {
  return "<li><a href=\"#" + mapped.id + "\">" +
    "<span>" + escapeHtml(mapped.title || "Untitled") + "</span>" +
    (mapped.description ? "<small class=\"sidebar-desc\">" + escapeHtml(mapped.description) + "</small>" : "") +
    "<time datetime=\"" + safeDateValue(mapped.date) + "\">" + displayDate(mapped.date) + "</time>" +
    "</a></li>";
}

function extractFirstParagraph(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || /^#/.test(line) || /^[-*]\s+/.test(line) || /^```/.test(line)) {
      continue;
    }

    const noMd = line
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/`(.+?)`/g, "$1");
    return noMd.length > 120 ? noMd.slice(0, 117) + "..." : noMd;
  }
  return "";
}

function renderContentGroups(items, renderItem, emptyMessage) {
  if (!Array.isArray(items) || items.length === 0) {
    return "<article class=\"blog-item\"><p>" + escapeHtml(emptyMessage || "No entries found.") + "</p></article>";
  }

  const grouped = groupItemsByFolder(items);
  return grouped.map(([groupName, groupItems]) => {
    const groupHeader = "<article class=\"blog-item\"><h2>" + humanizeGroupName(groupName) + "</h2></article>";
    return groupHeader + groupItems.map(renderItem).join("");
  }).join("");
}

function humanizeGroupName(groupName) {
  if (!groupName || groupName === "root") {
    return "Root";
  }
  return groupName;
}

function renderItemTags(tags) {
  if (!Array.isArray(tags) || tags.length === 0) {
    return "";
  }

  return "<div class=\"item-tags\">" + tags.map((tag) => {
    return "<span class=\"item-tag\">#" + escapeHtml(tag) + "</span>";
  }).join("") + "</div>";
}

function renderMarkdown(markdown) {
  if (window.marked && typeof window.marked.parse === "function") {
    return window.marked.parse(markdown);
  }

  return basicMarkdownToHtml(markdown);
}

function basicMarkdownToHtml(markdown) {
  const lines = markdown.split(/\r?\n/);
  const out = [];
  let inList = false;
  let inCode = false;
  let inQuote = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith("```") && !inCode) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      if (inQuote) {
        out.push("</blockquote>");
        inQuote = false;
      }
      out.push("<pre><code>");
      inCode = true;
      continue;
    }

    if (line.startsWith("```") && inCode) {
      out.push("</code></pre>");
      inCode = false;
      continue;
    }

    if (inCode) {
      out.push(escapeHtml(line));
      continue;
    }

    const quoteMatch = line.match(/^(>\s*)+/);
    if (quoteMatch) {
      closeListIfOpen(out, () => { inList = false; }, inList);
      if (!inQuote) {
        out.push("<blockquote>");
        inQuote = true;
      }

      const quoteText = line.replace(/^(>\s*)+/, "").trim();
      if (quoteText) {
        out.push("<p>" + inlineMarkdown(quoteText) + "</p>");
      }
      continue;
    }

    if (inQuote) {
      out.push("</blockquote>");
      inQuote = false;
    }

    if (/^###\s+/.test(line)) {
      closeListIfOpen(out, () => { inList = false; }, inList);
      out.push("<h3>" + inlineMarkdown(line.replace(/^###\s+/, "")) + "</h3>");
      continue;
    }

    if (/^##\s+/.test(line)) {
      closeListIfOpen(out, () => { inList = false; }, inList);
      out.push("<h2>" + inlineMarkdown(line.replace(/^##\s+/, "")) + "</h2>");
      continue;
    }

    if (/^#\s+/.test(line)) {
      closeListIfOpen(out, () => { inList = false; }, inList);
      out.push("<h1>" + inlineMarkdown(line.replace(/^#\s+/, "")) + "</h1>");
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push("<li>" + inlineMarkdown(line.replace(/^[-*]\s+/, "")) + "</li>");
      continue;
    }

    if (line === "") {
      closeListIfOpen(out, () => { inList = false; }, inList);
      continue;
    }

    closeListIfOpen(out, () => { inList = false; }, inList);
    out.push("<p>" + inlineMarkdown(line) + "</p>");
  }

  if (inList) {
    out.push("</ul>");
  }
  if (inQuote) {
    out.push("</blockquote>");
  }
  if (inCode) {
    out.push("</code></pre>");
  }

  return out.join("");
}

function closeListIfOpen(out, setClosed, isOpen) {
  if (isOpen) {
    out.push("</ul>");
    setClosed();
  }
}

function inlineMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/`(.+?)`/g, "<code>$1</code>");
  return html;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
