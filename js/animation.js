/**
 * Animation.js
 * Enthält alle Animationsfunktionen für die Website
 */

document.addEventListener('DOMContentLoaded', function() {
  // Verbesserte Parallax-Funktion mit Begrenzung
  const parallaxHeader = function() {
    const headerWrapper = document.querySelector('.header31_background-image-wrapper');
    const headerImage = document.querySelector('.header31_background-image');
    
    if (headerImage && headerWrapper) {
      const scrollPosition = window.scrollY;
      const headerRect = headerWrapper.getBoundingClientRect();
      // Beginne Parallax, wenn der Header oben im Viewport ist oder darüber
      const startParallax = headerRect.top <= 0;
      // Ende Parallax, wenn der untere Rand des Headers den Viewport verlässt
      const endParallax = headerRect.bottom <= 0;
      
      if (startParallax && !endParallax) {
        // Berechne, wie weit durch den Header gescrollt wurde (0 bis 1)
        const scrollRatio = Math.abs(headerRect.top) / headerRect.height;
        // Reduzierte Parallax-Intensität (maximal 15% der Header-Höhe)
        const translateY = Math.min(scrollRatio * headerRect.height * 0.15, headerRect.height * 0.15);
        headerImage.style.transform = `translateY(${translateY}px)`;
      } else if (endParallax) {
        // Setze Transform zurück oder auf Maximalwert, wenn Header nicht mehr sichtbar ist
        headerImage.style.transform = `translateY(${headerRect.height * 0.15}px)`;
      } else {
        // Setze Transform zurück, wenn Header noch nicht erreicht wurde
        headerImage.style.transform = `translateY(0px)`;
      }
    }
  };

  // Event-Listener für Scroll für Parallax-Effekt
  window.addEventListener('scroll', parallaxHeader);
  
  // Initial ausführen
  parallaxHeader();

  // Animationen für Elemente, die ins Sichtfeld scrollen
  const animateOnScroll = function() {
    const elements = document.querySelectorAll(
      // Wähle alle Elemente mit einer animate-* Klasse
      '[class*="animate-"]:not(.animate)' 
    );
    
    elements.forEach(function(element) {
      const elementPosition = element.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      // Trigger etwas früher (85% statt 90%)
      if (elementPosition.top < windowHeight * 0.85) {
        element.classList.add('animate');
      }
    });
  };
  
  // Event-Listener für Scroll hinzufügen
  window.addEventListener('scroll', animateOnScroll);
  
  // Initial-Aufruf für Elemente, die bereits im Viewport sind
  animateOnScroll();
  
  // Verbesserte Eingangs-Animation mit Verzögerung
  setTimeout(function() {
    document.body.classList.add('loaded');
    // Entfernt, da CSS dies nun handhabt: 
    // const header = document.querySelector('.section_header31');
    // if (header) { header.style.overflow = 'hidden'; }
  }, 100);
});

// Textanimation für Überschriften
function animateHeadlines() {
  const headlines = document.querySelectorAll('.animate-text');
  
  headlines.forEach(headline => {
    const text = headline.textContent;
    headline.textContent = '';
    
    // Jeden Buchstaben einzeln animieren
    for (let i = 0; i < text.length; i++) {
      const span = document.createElement('span');
      span.textContent = text[i] === ' ' ? '\u00A0' : text[i]; // Ersetze Leerzeichen
      span.style.animationDelay = `${i * 0.05}s`;
      headline.appendChild(span);
    }
    headline.classList.add('animate'); // Trigger Animation
  });
}

// Animationen initialisieren (kann aufgerufen werden, wenn benötigt)
window.initTextAnimations = function() {
  animateHeadlines();
}; 