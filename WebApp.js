/** Web app entry point and one-time setup. */

// Two pages, same data behind both:
//   <web app link>                 -> form.html       the POD form
//   <web app link>?view=dashboard  -> dashboard.html  the new dashboard front end
function doGet(e) {
  var view = e && e.parameter && e.parameter.view === 'dashboard' ? 'dashboard' : 'form';
  return HtmlService.createHtmlOutputFromFile(view)
    .setTitle('POD Form')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Run once from the editor: creates the DB tabs + POD folder and asks for permissions. */
function setup() {
  ensureSheet_(CFG.DIST_TAB, DIST_HEADERS);
  ensureSheet_(CFG.FREE_TAB, FREE_HEADERS);
  var f = podFolder_();
  Logger.log('Ready. DB: ' + SpreadsheetApp.openById(CFG.DB_ID).getUrl() + ' | POD folder: ' + f.getUrl());
}
