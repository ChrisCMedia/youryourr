// Menu Fix Script
document.addEventListener('DOMContentLoaded', function() {
  // Referenz zum Menü-Button und Menü
  var menuButton = document.querySelector('.navbar16_menu-button');
  var menu = document.querySelector('.navbar16_menu');
  var scrollPosition = 0;
  
  if (menuButton) {
    // Event-Listener für Klicks auf den Menü-Button
    menuButton.addEventListener('click', function() {
      // Prüfen, ob das Menü geöffnet oder geschlossen ist
      setTimeout(function() {
        if (menuButton.classList.contains('w--open')) {
          // Speichern der aktuellen Scroll-Position
          scrollPosition = window.pageYOffset;
          // Menü ist geöffnet
          document.body.classList.add('menu-open');
          document.body.style.top = -scrollPosition + 'px';
          
          // Verhindere Scrollen im Menü
          menu.addEventListener('touchmove', preventScroll, { passive: false });
          menu.addEventListener('wheel', preventScroll, { passive: false });
        } else {
          // Menü ist geschlossen
          document.body.classList.remove('menu-open');
          // Scroll-Position wiederherstellen
          window.scrollTo(0, scrollPosition);
          document.body.style.top = '';
          
          // Event-Listener entfernen
          menu.removeEventListener('touchmove', preventScroll);
          menu.removeEventListener('wheel', preventScroll);
        }
      }, 50); // Kleine Verzögerung, um sicherzustellen, dass die w--open Klasse aktualisiert wurde
    });
  }
  
  // Funktion zum Verhindern des Scrollens
  function preventScroll(e) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
}); 