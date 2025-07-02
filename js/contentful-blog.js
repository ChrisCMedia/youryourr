// js/contentful-blog.js

// --- Konfiguration ---
const CONTENTFUL_SPACE_ID = '1agkyf9fpd7h';
const CONTENTFUL_ACCESS_TOKEN = 'ZCr4zPOCDfBJ_Rq3q6iP2N_yIXm8HTOIF0LxzhGO6VE';

const CONTENTFUL_BLOG_POST_TYPE_ID = 'blogpost'; // Aus contentful.txt abgeleitet

// --- Sprach-/Locale-Erkennung ---
const currentLocale = window.location.pathname.includes('/en') ? 'en' : 'de-DE';

// +++ Pagination Variables +++
const POSTS_PER_PAGE = 21;
let currentOffset = 0;
let totalPosts = 0;
let isLoading = false; // Flag to prevent multiple simultaneous loads

// --- Contentful Client Initialisierung ---
let client = null;
try {
    if (window.contentful) {
        client = window.contentful.createClient({
            space: CONTENTFUL_SPACE_ID,
            accessToken: CONTENTFUL_ACCESS_TOKEN,
        });
        console.log("Contentful Client erfolgreich initialisiert.");
    } else {
        console.error("Contentful SDK nicht gefunden. Client konnte nicht initialisiert werden.");
    }
} catch (error) {
    console.error("Fehler bei der Initialisierung des Contentful Clients:", error);
}

// +++ Minimaler Verbindungstest +++
async function testContentfulConnection() {
    console.log("+++ Starte minimalen Verbindungstest +++");
    if (!window.contentful) {
        console.error("+++ TEST FEHLGESCHLAGEN: Contentful SDK nicht gefunden! +++");
        return;
    }
    try {
        const testClient = window.contentful.createClient({
            space: CONTENTFUL_SPACE_ID,
            accessToken: CONTENTFUL_ACCESS_TOKEN,
        });
        console.log("+++ Test-Client erstellt. Versuche Einträge abzurufen... +++");
        const response = await testClient.getEntries({ limit: 1 }); // Nur 1 Eintrag für den Test
        console.log("+++ TEST ERFOLGREICH: Antwort von Contentful: +++", response);
    } catch (error) {
        console.error("+++ TEST FEHLGESCHLAGEN: Fehler bei der Contentful-Abfrage: +++", error);
    }
    console.log("+++ Minimaler Verbindungstest beendet +++");
}
// Führe den Test sofort aus, wenn das Skript geladen wird
testContentfulConnection();
// +++ Ende Minimaler Verbindungstest +++

// --- Hilfsfunktionen ---
const getSafe = (fn, defaultValue = null) => {
  try {
    const result = fn();
    // console.log(`getSafe result for ${fn}:`, result); // Debugging
    return result;
  } catch (e) {
    // console.error(`getSafe error for ${fn}:`, e); // Debugging
    return defaultValue;
  }
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch (e) {
    console.error("Error formatting date:", dateString, e);
    return '';
  }
};

// Funktion zum Rendern von Rich Text
const renderRichText = (richTextDocument) => {
    // Prüfen ob der Renderer und das Dokument vorhanden sind
    if (!richTextDocument || typeof window.richTextHtmlRenderer?.documentToHtmlString !== 'function') {
        // Fallback, wenn kein Rich Text oder Renderer nicht geladen
        console.warn("Rich Text Renderer nicht verfügbar oder kein Rich Text Dokument.");
        // Versuche, einfachen Text oder Markdown zu behandeln
        if (typeof richTextDocument === 'string') {
            return richTextDocument.replace(/\n/g, '<br>'); // Einfache Zeilenumbrüche für String
        } else if (typeof richTextDocument?.content?.[0]?.content?.[0]?.value === 'string'){
             // Versuche, einfachen Text aus einer Standard-RichText-Struktur zu extrahieren
             let simpleText = '';
             richTextDocument.content.forEach(block => {
                 if(block.nodeType === 'paragraph') {
                     block.content.forEach(inline => {
                         if(inline.nodeType === 'text') {
                             simpleText += inline.value;
                         }
                     });
                     simpleText += '<br>'; // Absatz als Zeilenumbruch
                 }
             });
             return simpleText;
        }
        return '<p>Inhalt konnte nicht korrekt angezeigt werden.</p>';
    }

    // Optionen für den Renderer
    const options = {
        renderNode: {
            [richTextHtmlRenderer.BLOCKS.EMBEDDED_ASSET]: (node) => {
                const file = getSafe(() => node.data.target.fields.file);
                const description = getSafe(() => node.data.target.fields.description, '');
                const url = getSafe(() => file.url);

                if (file && url && file.contentType.startsWith('image/')) {
                    return `<img src="${url}" alt="${description}" style="max-width: 100%; height: auto; margin-top: 1em; margin-bottom: 1em;"/>`;
                }
                // Hier könnten weitere Asset-Typen (z.B. PDFs) behandelt werden
                return '';
            },
             // Optional: Überschriften rendern, falls nötig (normalerweise nicht, da HTML-Tags verwendet werden)
             /*
             [richTextHtmlRenderer.BLOCKS.HEADING_1]: (node, next) => `<h1 class="heading-style-h1">${next(node.content)}</h1>`,
             [richTextHtmlRenderer.BLOCKS.HEADING_2]: (node, next) => `<h2 class="heading-style-h2">${next(node.content)}</h2>`,
             */
             // Optional: Behandlung für Links oder andere Elemente hinzufügen
             [richTextHtmlRenderer.INLINES.HYPERLINK]: (node, next) => {
                const uri = getSafe(() => node.data.uri, '#');
                return `<a href="${uri}" target="_blank" rel="noopener noreferrer">${next(node.content)}</a>`;
             },
             [richTextHtmlRenderer.BLOCKS.QUOTE]: (node, next) => {
                // Stelle sicher, dass eine Blockquote-Klasse verwendet wird, falls vorhanden
                return `<blockquote class="text-style-quote">${next(node.content)}</blockquote>`;
             }
        },
    };

    try {
        return richTextHtmlRenderer.documentToHtmlString(richTextDocument, options);
    } catch (error) {
        console.error("Fehler beim Rendern von Rich Text:", error, richTextDocument);
        return '<p>Inhalt konnte aufgrund eines Fehlers nicht angezeigt werden.</p>';
    }
};

// --- Funktion zum Rendern eines einzelnen Blog-Posts (für Übersicht und Nachladen) ---
function renderBlogPostItem(postFields) {
    const post = postFields;
    const slug = getSafe(() => post.permalink, '');
    if (!slug) {
        console.warn("Skipping post without permalink (slug):", getSafe(() => post.title));
        return null; // Return null if no slug
    }

    const imageUrl = getSafe(() => post.featuredImage.fields.file.url);
    const imageAlt = getSafe(() => post.featuredImage.fields.description, getSafe(() => post.title, 'Blogbild'));
    const titel = getSafe(() => post.title, 'Ohne Titel');
    // const datum = formatDate(getSafe(() => post.date)); // Datum wird im aktuellen Design nicht angezeigt
    const tagsRaw = getSafe(() => post.tags);
    const tagsList = Array.isArray(tagsRaw) ? tagsRaw : [];
    const kategorie = tagsList.length > 0 ? tagsList[0] : 'Allgemein';

    const postElement = document.createElement('div');
    postElement.className = 'blog_featured-blog-liste-header-sektion_item';

    const linkElement = document.createElement('a');
    linkElement.href = `detail_post.html?slug=${slug}`;
    linkElement.className = 'blog_featured-blog-liste-header-sektion_item-link w-inline-block';

    linkElement.innerHTML = `
      <div class="margin-bottom margin-small">
        <div class="blog_featured-blog-liste-header-sektion_image-wrapper">
          ${imageUrl ? `<img src="${imageUrl}?w=800&fit=thumb&fm=webp" loading="lazy" alt="${imageAlt}" class="home_blog-list_image blog-item-image">` : '<div class="home_blog-list_image placeholder blog-item-image" style="background:#eee; width:100%; height: 230px;"></div>'}
        </div>
      </div>
      <div class="blog_featured-blog-liste-header-sektion_item-content"> <!-- Added wrapper for content below image -->
        <div class="margin-bottom margin-xsmall">
          <div class="blog_featured-blog-liste-header-sektion_meta-wrapper">
            <div class="tag"><div class="text-block">${kategorie}</div></div>
          </div>
        </div>
        <div class="margin-bottom margin-xxsmall">
          <h3 class="heading-style-h4">${titel}</h3>
        </div>
        <div class="margin-top margin-small read-more-link"> <!-- Added read-more-link class -->
          <div class="button-group">
              <div class="button is-link is-icon">
                  <div>Mehr lesen</div>
                  <div class="icon-embed-xxsmall w-embed"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 3L11 8L6 13" stroke="currentColor" stroke-width="1.5"></path></svg></div>
              </div>
          </div>
        </div>
      </div>
    `;
    postElement.appendChild(linkElement);
    return postElement; // Return the DOM element
}

// --- Funktion zum Überprüfen und Anzeigen/Ausblenden des "Mehr laden"-Buttons ---
function checkLoadMoreButtonVisibility() {
    const loadMoreButton = document.getElementById('load-more-button');
    if (!loadMoreButton) return;

    // console.log(`Checking button visibility: currentOffset=${currentOffset}, POSTS_PER_PAGE=${POSTS_PER_PAGE}, totalPosts=${totalPosts}`); // Debugging

    if (currentOffset + POSTS_PER_PAGE < totalPosts) {
        loadMoreButton.style.display = 'block'; // Show button if more posts exist
        loadMoreButton.disabled = false;
        loadMoreButton.innerText = 'Weitere Artikel laden';
    } else {
        loadMoreButton.style.display = 'none'; // Hide button if no more posts
    }
}

// --- Blog-Übersichtsseite (`blog.html`) - Angepasst für Pagination ---
async function loadBlogOverview() {
  const gridContainer = document.querySelector('.blog_featured-blog-liste-header-sektion_list');
  const loadMoreButton = document.getElementById('load-more-button'); // Get button reference

  if (!gridContainer || !loadMoreButton || !client) {
      console.warn("Blog Grid Container, Load More Button oder Client nicht initialisiert.");
      if (gridContainer) gridContainer.innerHTML = '<p>Initialisierungsfehler.</p>';
      return;
  }

  // Nur beim ersten Laden den Indikator anzeigen und Offset zurücksetzen
  if (currentOffset === 0) {
      gridContainer.innerHTML = '<p>Lade Blogbeiträge...</p>'; // Ladeindikator
  } else {
      // Wenn nachgeladen wird, Button deaktivieren und Text ändern
      loadMoreButton.disabled = true;
      loadMoreButton.innerText = 'Lade...';
  }
  isLoading = true; // Set loading flag


  try {
    const response = await client.getEntries({
      content_type: CONTENTFUL_BLOG_POST_TYPE_ID,
      locale: currentLocale,
      order: '-fields.date',
      limit: POSTS_PER_PAGE, // Use limit for pagination
      skip: currentOffset,   // Use skip for pagination
    });

    // console.log("Blog Overview Response (Paginated):", response); // Debugging

    // Beim ersten Laden das Grid leeren und Gesamtzahl speichern
    if (currentOffset === 0) {
        gridContainer.innerHTML = ''; // Leere das Grid nur beim ersten Laden
        totalPosts = response.total; // Store total number of posts
        // console.log(`Total posts found: ${totalPosts}`); // Debugging
    }

    if (response.items && response.items.length > 0) {
      response.items.forEach(item => {
        const postElement = renderBlogPostItem(item.fields); // Use the render function
        if (postElement) {
             gridContainer.appendChild(postElement);
        }
      });

      currentOffset += response.items.length; // Update the offset

    } else if (currentOffset === 0) {
      // Nur wenn beim ersten Laden keine Items kamen
      gridContainer.innerHTML = '<p>Keine Blogbeiträge gefunden.</p>';
    }

    checkLoadMoreButtonVisibility(); // Check visibility after loading

  } catch (error) {
    console.error('Fehler beim Laden der Blog-Übersicht:', error);
    // Fehler im Grid anzeigen, wenn es leer ist, sonst nur in der Konsole
    if (currentOffset === 0) {
        gridContainer.innerHTML = '<p>Fehler beim Laden der Blogbeiträge. Bitte versuchen Sie es später erneut.</p>';
    } else {
         // Reset button state on error during load more
         loadMoreButton.disabled = false;
         loadMoreButton.innerText = 'Weitere Artikel laden';
         checkLoadMoreButtonVisibility(); // Re-check visibility
    }
  } finally {
      isLoading = false; // Reset loading flag
  }
}

// +++ Event Listener für "Mehr laden"-Button +++
function setupLoadMoreButton() {
    const loadMoreButton = document.getElementById('load-more-button');
    if (loadMoreButton) {
        loadMoreButton.addEventListener('click', () => {
            if (!isLoading) { // Load only if not already loading
                loadBlogOverview(); // Call the same function to load the next batch
            }
        });
         // Initial hide, will be shown by checkLoadMoreButtonVisibility if needed
         loadMoreButton.style.display = 'none';
    } else {
        console.warn("Load More Button nicht im DOM gefunden beim Setup.");
    }
}

// --- Einzelner Blogbeitrag (`detail_post.html`) ---
async function loadSinglePost() {
  const container = document.getElementById('post-content'); // Ziel-Container auf detail_post.html
  const titleEl = document.getElementById('post-title');
  const metaEl = document.getElementById('post-meta');
  const imageEl = document.getElementById('post-image');
  const bodyEl = document.getElementById('post-body');

  if (!container || !client || !titleEl || !metaEl || !imageEl || !bodyEl) {
      console.warn("Einige Elemente auf detail_post.html fehlen oder Contentful Client nicht initialisiert.");
      if(container) container.innerHTML = "<p>Fehler: Seite nicht korrekt initialisiert.</p>";
      return;
  };

  const urlParams = new URLSearchParams(window.location.search);
  const slug = urlParams.get('slug');

  if (!slug) {
    titleEl.innerText = 'Beitrag nicht gefunden (kein Slug angegeben).';
    metaEl.innerText = '';
    imageEl.style.display = 'none';
    bodyEl.innerHTML = '';
    return;
  }

  titleEl.innerText = 'Lade Beitrag...'; // Ladeindikator
  metaEl.innerText = '';
  imageEl.style.display = 'none';
  bodyEl.innerHTML = '<p>Lade Inhalt...</p>';

  try {
    const response = await client.getEntries({
      content_type: CONTENTFUL_BLOG_POST_TYPE_ID,
      locale: currentLocale,
      'fields.permalink': slug, // KORREKTUR: slug -> permalink
      limit: 1,
      // Wähle alle Felder aus, die du brauchst, inklusive des Rich Text Feldes
      // select: 'fields.title,fields.permalink,fields.date,fields.featuredImage,fields.content' // Korrekte Feldnamen im Select (optional)
    });

    // console.log("Single Post Response:", response); // Debugging

    if (response.items && response.items.length > 0) {
      const post = response.items[0].fields;

      const titel = getSafe(() => post.title, 'Ohne Titel'); // KORREKTUR: titel -> title
      const datum = formatDate(getSafe(() => post.date));
      // const autor = getSafe(() => post.autor); // ENTFERNT: Feld nicht im Modell sichtbar

      document.title = `${titel} - Blog`; // Seitentitel aktualisieren
      titleEl.innerText = titel;
      // metaEl.innerText = `Veröffentlicht am ${datum}${autor ? ' von ' + autor : ''}`; // Angepasst ohne Autor
      metaEl.innerText = `Veröffentlicht am ${datum}`;

      const imageUrl = getSafe(() => post.featuredImage.fields.file.url); // KORREKTUR: titelbild -> featuredImage
      const imageAlt = getSafe(() => post.featuredImage.fields.description, titel); // KORREKTUR: titelbild -> featuredImage
      if (imageUrl) {
        imageEl.src = `${imageUrl}?w=1000&fm=webp&q=80`; // Lade optimiertes Bild
        imageEl.alt = imageAlt;
        imageEl.style.display = 'block';
        imageEl.loading = 'lazy'; // Lazy loading für das Hauptbild
      } else {
        imageEl.style.display = 'none';
      }

      // Rendere den Hauptinhalt
      const inhalt = getSafe(() => post.content); // KORREKTUR: inhalt -> content
      // console.log("Inhalt Field:", JSON.stringify(inhalt, null, 2)); // Debugging
      bodyEl.innerHTML = renderRichText(inhalt);

    } else {
      titleEl.innerText = 'Beitrag nicht gefunden.';
      metaEl.innerText = '';
      imageEl.style.display = 'none';
      bodyEl.innerHTML = '<p>Der angeforderte Blogbeitrag konnte nicht gefunden werden.</p>';
      document.title = "Beitrag nicht gefunden - Blog";
    }
  } catch (error) {
    console.error('Fehler beim Laden des einzelnen Blogbeitrags:', error);
    titleEl.innerText = 'Fehler beim Laden des Beitrags.';
    metaEl.innerText = '';
    imageEl.style.display = 'none';
    bodyEl.innerHTML = '<p>Der Beitrag konnte nicht geladen werden. Bitte versuchen Sie es später erneut.</p>';
    document.title = "Fehler - Blog";
  }
}

// --- Homepage Blog-Vorschau (`index.html`, `index-en.html`) ---
async function loadHomepagePreview() {
  // Ziel-Container auf index.html (das Grid selbst)
  const gridContainer = document.querySelector('.home_blog-list_list'); // Das ist das Grid
  if (!gridContainer || !client) {
      console.warn("Homepage Preview Container oder Client nicht gefunden.");
      return;
  }

  // Optional: Ladeindikator (z.B. im darüberliegenden Wrapper)
  const listWrapper = document.querySelector('.home_blog-list_list-wrapper');
  // if(listWrapper) listWrapper.innerHTML = '<p>Lade neueste Beiträge...</p>';


  try {
    const response = await client.getEntries({
      content_type: CONTENTFUL_BLOG_POST_TYPE_ID,
      locale: currentLocale,
      order: '-fields.date', // Korrekter Feldname für die Sortierung
      limit: 3, // Lade die 3 neuesten Beiträge
      // select: 'fields.title,fields.permalink,fields.date,fields.featuredImage,fields.tags' // Korrekte Feldnamen im Select (optional)
    });

    // console.log("Homepage Preview Response:", response); // Debugging

    if (response.items && response.items.length > 0) {
      gridContainer.innerHTML = ''; // Leere das Grid
      response.items.forEach(item => {
        const post = item.fields;
        const slug = getSafe(() => post.permalink, '');
        if (!slug) {
          console.warn("Skipping homepage preview post without permalink (slug):", getSafe(() => post.title));
          return;
        }

        const imageUrl = getSafe(() => post.featuredImage.fields.file.url);
        const imageAlt = getSafe(() => post.featuredImage.fields.description, getSafe(() => post.title, 'Blogbild'));
        const titel = getSafe(() => post.title, 'Ohne Titel');
        const tagsRaw = getSafe(() => post.tags);
        const tagsList = Array.isArray(tagsRaw) ? tagsRaw : [];
        const kategorie = tagsList.length > 0 ? tagsList[0] : 'Allgemein';

        const postElementWrapper = document.createElement('div');
        postElementWrapper.className = 'home_blog-list_item';

        // Bild-URL und srcset für hohe Auflösung und Retina
        let imageTag = '';
        if (imageUrl) {
          imageTag = `<img 
            src="${imageUrl}?w=900&h=675&fit=fill&fm=webp" 
            srcset="${imageUrl}?w=900&h=675&fit=fill&fm=webp 1x, ${imageUrl}?w=1800&h=1350&fit=fill&fm=webp 2x" 
            loading="lazy" 
            alt="${imageAlt}" 
            class="home_blog-list_image">
          `;
        } else {
          imageTag = '<div class="home_blog-list_image placeholder" style="background:#eee; width:100%; padding-top: 75%;"></div>';
        }

        postElementWrapper.innerHTML = `
          <a href="detail_post.html?slug=${slug}" class="home_blog-list_item-link w-inline-block">
            <div class="margin-bottom margin-small">
              <div class="home_blog-list_image-wrapper">
                ${imageTag}
              </div>
            </div>
            <div class="margin-bottom margin-xsmall">
              <div class="home_blog-list_meta-wrapper">
                <div class="tag-list">
                  ${tagsList.map(tag => `<span class="tag-item">${tag}</span>`).join('')}
                </div>
              </div>
            </div>
            <div class="margin-bottom margin-xxsmall">
              <div class="blog-preview-date-teaser">
                <div class="blog-preview-date">${formatDate(getSafe(() => post.date))}</div>
              </div>
              <h3 class="heading-style-h4">${titel}</h3>
            </div>
            <div class="margin-top margin-small">
              <div class="button-group">
                <div class="button is-link is-icon">
                  <div>Mehr lesen</div>
                  <div class="icon-embed-xxsmall w-embed"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 3L11 8L6 13" stroke="currentColor" stroke-width="1.5"></path></svg></div>
                </div>
              </div>
            </div>
          </a>
        `;
        gridContainer.appendChild(postElementWrapper);
      });

      // Wenn der Ladeindikator im Wrapper war, entferne ihn jetzt
      // if(listWrapper && listWrapper.firstChild?.tagName === 'P') {
      //     listWrapper.innerHTML = '';
      //     listWrapper.appendChild(gridContainer);
      // }

    } else {
      // Optional: Nachricht anzeigen, wenn keine Beiträge vorhanden sind
      if(listWrapper) listWrapper.innerHTML = '<p>Keine aktuellen Blogbeiträge vorhanden.</p>';
    }
  } catch (error) {
    console.error('Fehler beim Laden der Homepage Blog-Vorschau:', error);
    // Optional: Fehlermeldung anzeigen
    if(listWrapper) listWrapper.innerHTML = '<p>Fehler beim Laden der Beiträge.</p>';
  }
}

// --- Seitenlogik Ausführung ---
function runPageLogic() {
  if (!client) {
    console.error("Contentful SDK nicht gefunden oder Initialisierung fehlgeschlagen.");
    // Zeige ggf. eine Fehlermeldung für den Benutzer an
    const errorContainers = document.querySelectorAll('#blog-list-container, #post-content, .home_blog-list_list');
    errorContainers.forEach(el => {
        if(el) el.innerHTML = '<p>Fehler bei der Verbindung zum Content Management System.</p>';
    });
    return;
  }

  const pagePath = window.location.pathname;
  const pageName = pagePath.substring(pagePath.lastIndexOf('/') + 1);

  // console.log("Running Page Logic for:", pageName || "index.html"); // Debugging

  if (pageName.includes('blog.html')) {
    console.log("Running logic for blog.html");
    // Initialen Ladevorgang starten
    loadBlogOverview();
    // Event Listener für Button hinzufügen (muss nach dem initialen Laden erfolgen,
    // aber der Button muss im HTML sein!)
    // Wir rufen dies hier auf, da das Skript am Ende des Body geladen wird.
    setupLoadMoreButton();
  } else if (pageName.includes('detail_post.html')) {
    loadSinglePost();
  } else if (pageName === '' || pageName === 'index.html') { // Homepage erkennen
    loadHomepagePreview();
  } else if (pageName === 'index-en.html') {
     // Aktuell gleiche Logik wie index.html, könnte angepasst werden
     // loadHomepagePreview('en-US'); // Beispiel: Übergabe eines Locale-Parameters
     loadHomepagePreview();
  }
}

// Führe die Logik aus, wenn das DOM bereit ist
// Stelle sicher, dass dies nicht zu früh ausgeführt wird, falls Webflow JS noch lädt
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runPageLogic);
} else {
    // DOM bereits geladen
    runPageLogic();
} 