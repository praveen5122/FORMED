/**
 * Free Quantity & Discounted Product Distribution - Apps Script web app (backend)
 *
 * READS (never written to):
 *   Weekly Sales Tracker : Assignments (region/HQ/L0/L1/L2/stockist), Stockists (sr no.),
 *                          SecondarySales (discounted qty by stockist + product)
 *   CentForce_Master     : doctors + chemists per BDM
 * WRITES:
 *   POD Form sheet (DB_ID): tab DISTRIBUTION (one row per product line), tab FREE_QTY_MASTER (you fill)
 *   Drive folder "POD Uploads": POD files
 *
 * Owner: Premchand. Run setup() once after pasting.
 */

var CFG = {
  DB_ID:      '1jp8oWl3t8U3ZtFtKIAQNHjwIwQZOQALCIjgpy_q2oog',   // POD Form sheet = the database
  TRACKER_ID: '1f9vzdCMzvdSQzEGe6t7qaov7dXZoO-pATWPzKb3M03A',   // Weekly Sales Tracker (read only)
  MASTER_ID:  '1vAXkSp9oJX5b7UXeEDC_gfuHcrgrHaSLPGK2wd24lDY',   // CentForce_Master (read only)
  DIST_TAB:   'DISTRIBUTION',
  FREE_TAB:   'FREE_QTY_MASTER',
  POD_FOLDER: 'POD Uploads',
  TZ:         'Asia/Kolkata',
  POD_MAX_BYTES: 20 * 1024 * 1024,         // per file
  POD_MAX_TOTAL: 25 * 1024 * 1024,         // all files of one entry (keeps the upload under Apps Script's request limit)
  POD_MAX_FILES: 10,
  POD_TYPES: { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' },
  DUP_WINDOW_MIN: 10,
  CACHE_SECS: 300,
  // Assignments L0 spelling + HQ -> CentForce Emp_Code, where the two sheets spell the BDM differently.
  // Only pairs checked against DIM_Employee (name AND HQ agree). Add a line here when a new mismatch shows up.
  EMP_OVERRIDES: {
    'AKHIL CHANDRAN|ALLAPPEY':              'JPPL697',   // Akhil Chandran P (Alappuzha alias in MAP_Employee_Alias)
    'GURUSAMY|CHENNAI 2':                   'JPPL722',   // V Gurusamy
    'RAMSUNDER|CHENNAI 3':                  'JPPL714',   // Ram Sundar D
    'ANAD ATHIYAPPAN|MADURAI 2':            'JPPL684',   // Anand Aathiyappan
    'ELANGOVAN P|COIMBATORE 1':             'JPPL647',   // P Elangovan
    'VIJAYAKUMAR KANNIYAN|ERODE':           'JPPL686',   // VijayaKumar Kannaiyan
    'GANGADHAR K|MAHABOOBNAGAR':            'JPPL665',   // K Gangadhar (Mahboobnagar)
    'GAJULA VINODH KUMAR|NALGONDA':         'JPPL716',   // Gajula Vinod Kumar
    'JERIPOTHULA CHANDRASHEKAR|KARIMNAGAR': 'JPPL709',   // Jeripothulachandrashekar
    'PALIPU ESHWAR KUMAR|VIJAYWADA':        'JPPL735',   // Palipu Eeswar Kumar
    'P SUNIL KUMAR|BANGALORE 1':            'JPPL718'    // Polu Sunil Kumar Reddy
  }
};

var DIST_HEADERS = [
  'Entry ID', 'Submitted At', 'Month', 'Region', 'Role', 'Submitted By', 'HQ', 'BDM (L0)',
  'Stockist Sr', 'Stockist', 'Doctor', 'Chemist/Pharmacy', 'Product',
  'Free Qty Available (CentForce)', 'Discounted Qty Available (Weekly Statement)',
  'Free Qty Distributed', 'Discounted Qty Distributed', 'POD File', 'POD Link', 'Content Hash'
];
var FREE_HEADERS = ['Month', 'Stockist Sr', 'Stockist', 'Product', 'Free Qty'];
