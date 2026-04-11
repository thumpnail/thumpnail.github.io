document.addEventListener("DOMContentLoaded", () => {
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
});

const SITE_ROOT_PREFIX = window.location.pathname.includes("/pages/") ? "../" : "";

async function loadBlogPosts(blogList) {
  const blogSidebarList = document.getElementById("blog-sidebar-list");

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
      return;
    }

    const cards = await Promise.all(posts.map(async (post, index) => {
      const postPath = resolveBlogMarkdownPath(post.file);
      const postResponse = await fetch(postPath);
      if (!postResponse.ok) {
        throw new Error("Could not load post: " + postPath);
      }
      const markdown = await postResponse.text();
      return {
        id: buildItemId(post.title || "post", index),
        title: post.title,
        date: post.date,
        postPath: postPath,
        html: renderMarkdown(markdown)
      };
    }));

    if (blogSidebarList) {
      blogSidebarList.innerHTML = cards.map((card) => {
        return "<li><a href=\"#" + card.id + "\">" +
          "<span>" + (card.title || "Untitled") + "</span>" +
          "<time datetime=\"" + safeDateValue(card.date) + "\">" + displayDate(card.date) + "</time>" +
          "</a></li>";
      }).join("");
    }

    blogList.innerHTML = cards.map((card) => {
      return "<article id=\"" + card.id + "\" class=\"blog-item\">" +
        "<time datetime=\"" + safeDateValue(card.date) + "\">" + displayDate(card.date) + "</time>" +
        "<h3>" + card.title + "</h3>" +
        "<div class=\"blog-content\">" + card.html + "</div>" +
        "<p><a href=\"content.html?file=" + encodeURIComponent(card.postPath) + "&title=" + encodeURIComponent(card.title) + "\">Open rendered post</a></p>" +
        "</article>";
    }).join("");
  } catch (error) {
    blogList.innerHTML = "<article class=\"blog-item\"><p>Blog could not be loaded right now. Please check blog/posts.json and markdown file paths.</p></article>";
    console.error(error);
  }
}

async function loadProjects(projectList) {
  const projectSidebarList = document.getElementById("project-sidebar-list");

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
      return;
    }

    const cards = await Promise.all(projects.map(async (project, index) => {
      const markdownPath = resolveProjectMarkdownPath(project.markdown);
      const markdownResponse = await fetch(markdownPath);
      if (!markdownResponse.ok) {
        throw new Error("Could not load project markdown: " + markdownPath);
      }

      const markdown = await markdownResponse.text();
      return {
        id: buildItemId(project.name || "project", index),
        name: project.name || "Untitled Project",
        date: project.date || "",
        description: project.description || "",
        markdownPath: markdownPath,
        html: renderMarkdown(markdown)
      };
    }));

    if (projectSidebarList) {
      projectSidebarList.innerHTML = cards.map((card) => {
        return "<li><a href=\"#" + card.id + "\">" +
          "<span>" + card.name + "</span>" +
          "<time datetime=\"" + safeDateValue(card.date) + "\">" + displayDate(card.date) + "</time>" +
          "</a></li>";
      }).join("");
    }

    projectList.innerHTML = cards.map((card) => {
      return "<article id=\"" + card.id + "\" class=\"blog-item\">" +
        "<time datetime=\"" + safeDateValue(card.date) + "\">" + displayDate(card.date) + "</time>" +
        "<h3>" + card.name + "</h3>" +
        (card.description ? "<p>" + card.description + "</p>" : "") +
        "<div class=\"blog-content\">" + card.html + "</div>" +
        "<p><a href=\"content.html?file=" + encodeURIComponent(card.markdownPath) + "&title=" + encodeURIComponent(card.name) + "\">Open rendered project</a></p>" +
        "</article>";
    }).join("");
  } catch (error) {
    projectList.innerHTML = "<article class=\"blog-item\"><p>Projects could not be loaded right now. Please check projects/projects.json and markdown paths.</p></article>";
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
  return SITE_ROOT_PREFIX + relativePath;
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

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith("```") && !inCode) {
      if (inList) {
        out.push("</ul>");
        inList = false;
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
