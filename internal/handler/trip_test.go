package handler

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/maulana/perjadin-personal/internal/auth"
	"github.com/maulana/perjadin-personal/internal/storage"
)

var testStorageDir, _ = os.MkdirTemp("", "perjadin_test_storage_*")
var testStorage = storage.NewLocalStorage(testStorageDir)

func setupTripRoutes() http.Handler {
	mux := http.NewServeMux()
	authMW := auth.AuthMiddleware(testJWTSecret)

	mux.Handle("GET /api/trips", authMW(http.HandlerFunc(ListTrips(testDB))))
	mux.Handle("POST /api/trips", authMW(http.HandlerFunc(CreateTrip(testDB))))
	mux.Handle("GET /api/trips/{id}", authMW(http.HandlerFunc(GetTrip(testDB))))
	mux.Handle("PUT /api/trips/{id}", authMW(http.HandlerFunc(UpdateTrip(testDB))))
	mux.Handle("DELETE /api/trips/{id}", authMW(http.HandlerFunc(DeleteTrip(testDB))))
	mux.Handle("POST /api/trips/parse-document", authMW(http.HandlerFunc(ParseDocumentHandler(testDB, testStorage))))
	mux.Handle("GET /api/trips/{id}/dokumen", authMW(http.HandlerFunc(ServeTripDokumenHandler(testDB, testStorage))))
	return mux
}

func TestCreateTrip(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "google-user", "user@test.com", "user")
	cookie := authCookie(t, userID, "user")
	handler := setupTripRoutes()

	rec := doRequest(t, handler, "POST", "/api/trips", `{
		"nama": "Dinas Jakarta",
		"tujuan": "Jakarta",
		"tanggal_mulai": "2026-11-20",
		"tanggal_selesai": "2026-11-25"
	}`, cookie)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	body := parseJSON(t, rec)
	data := body["data"].(map[string]interface{})
	if data["nama"] != "Dinas Jakarta" {
		t.Errorf("expected nama=Dinas Jakarta, got %v", data["nama"])
	}
	if data["status"] == nil || data["status"] == "" {
		t.Error("expected status field")
	}
}

func TestCreateTrip_InvalidDates(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "google-user", "user@test.com", "user")
	cookie := authCookie(t, userID, "user")
	handler := setupTripRoutes()

	rec := doRequest(t, handler, "POST", "/api/trips", `{
		"nama": "Bad",
		"tujuan": "X",
		"tanggal_mulai": "2026-11-25",
		"tanggal_selesai": "2026-11-20"
	}`, cookie)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}
}

func TestListTrips(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "google-user", "user@test.com", "user")
	user2ID := createTestUser(t, "google-user2", "user2@test.com", "user")
	cookie := authCookie(t, userID, "user")
	handler := setupTripRoutes()

	// Create trips for both users
	testDB.Exec(`INSERT INTO trips (user_id, nama, tujuan, tanggal_mulai, tanggal_selesai)
		VALUES ($1, 'Mine', 'A', '2026-01-01', '2026-01-05')`, userID)
	testDB.Exec(`INSERT INTO trips (user_id, nama, tujuan, tanggal_mulai, tanggal_selesai)
		VALUES ($1, 'NotMine', 'B', '2026-01-01', '2026-01-05')`, user2ID)

	rec := doRequest(t, handler, "GET", "/api/trips", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	body := parseJSON(t, rec)
	data := body["data"].([]interface{})
	if len(data) != 1 {
		t.Errorf("expected 1 trip, got %d", len(data))
	}
	trip := data[0].(map[string]interface{})
	if trip["nama"] != "Mine" {
		t.Errorf("expected Mine, got %v", trip["nama"])
	}
}

func TestGetTrip_OtherUser(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "google-user", "user@test.com", "user")
	user2ID := createTestUser(t, "google-user2", "user2@test.com", "user")
	cookie := authCookie(t, userID, "user")
	handler := setupTripRoutes()

	var tripID string
	testDB.QueryRow(`INSERT INTO trips (user_id, nama, tujuan, tanggal_mulai, tanggal_selesai)
		VALUES ($1, 'Secret', 'B', '2026-01-01', '2026-01-05') RETURNING id`, user2ID).Scan(&tripID)

	rec := doRequest(t, handler, "GET", "/api/trips/"+tripID, "", cookie)
	if rec.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", rec.Code)
	}
}

func TestUpdateTrip(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "google-user", "user@test.com", "user")
	cookie := authCookie(t, userID, "user")
	handler := setupTripRoutes()

	var tripID string
	testDB.QueryRow(`INSERT INTO trips (user_id, nama, tujuan, tanggal_mulai, tanggal_selesai)
		VALUES ($1, 'Old', 'A', '2026-01-01', '2026-01-05') RETURNING id`, userID).Scan(&tripID)

	rec := doRequest(t, handler, "PUT", "/api/trips/"+tripID, `{
		"nama": "Updated",
		"uang_dinas": 5000000,
		"tanggal_dibayar": "2026-02-01"
	}`, cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	body := parseJSON(t, rec)
	data := body["data"].(map[string]interface{})
	if data["nama"] != "Updated" {
		t.Errorf("expected Updated, got %v", data["nama"])
	}
}

func TestDeleteTrip(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "google-user", "user@test.com", "user")
	cookie := authCookie(t, userID, "user")
	handler := setupTripRoutes()

	var tripID string
	testDB.QueryRow(`INSERT INTO trips (user_id, nama, tujuan, tanggal_mulai, tanggal_selesai)
		VALUES ($1, 'Delete', 'A', '2026-01-01', '2026-01-05') RETURNING id`, userID).Scan(&tripID)

	rec := doRequest(t, handler, "DELETE", "/api/trips/"+tripID, "", cookie)
	if rec.Code != http.StatusNoContent {
		t.Errorf("expected 204, got %d", rec.Code)
	}
}

func TestTripSQLConstants(t *testing.T) {
	if strings.Contains(tripInsertCols, "t.") {
		t.Errorf("tripInsertCols cannot contain 't.' table alias because it is used in INSERT RETURNING clauses")
	}
}

func TestTrip_EstimasiTransport(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "google-user", "user@test.com", "user")
	cookie := authCookie(t, userID, "user")
	handler := setupTripRoutes()

	// 1. Create trip with estimasi_transport
	rec := doRequest(t, handler, "POST", "/api/trips", `{
		"nama": "Dinas Bandung",
		"tujuan": "Bandung",
		"tanggal_mulai": "2026-11-20",
		"tanggal_selesai": "2026-11-22",
		"nominal_monita": 1830000,
		"estimasi_transport": 540000
	}`, cookie)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	body := parseJSON(t, rec)
	data := body["data"].(map[string]interface{})
	tripID := data["id"].(string)

	if data["estimasi_transport"] == nil {
		t.Fatalf("expected estimasi_transport in create response, got nil")
	}
	if val := int64(data["estimasi_transport"].(float64)); val != 540000 {
		t.Errorf("expected estimasi_transport 540000, got %d", val)
	}

	// 2. GetTrip must return estimasi_transport
	recGet := doRequest(t, handler, "GET", "/api/trips/"+tripID, "", cookie)
	if recGet.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recGet.Code, recGet.Body.String())
	}
	bodyGet := parseJSON(t, recGet)
	dataGet := bodyGet["data"].(map[string]interface{})
	if dataGet["estimasi_transport"] == nil {
		t.Fatalf("expected estimasi_transport in get response, got nil")
	}
	if val := int64(dataGet["estimasi_transport"].(float64)); val != 540000 {
		t.Errorf("expected estimasi_transport 540000, got %d", val)
	}

	// 3. Update estimasi_transport
	recPut := doRequest(t, handler, "PUT", "/api/trips/"+tripID, `{
		"estimasi_transport": 750000
	}`, cookie)
	if recPut.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recPut.Code, recPut.Body.String())
	}
	bodyPut := parseJSON(t, recPut)
	dataPut := bodyPut["data"].(map[string]interface{})
	if dataPut["estimasi_transport"] == nil {
		t.Fatalf("expected estimasi_transport in put response, got nil")
	}
	if val := int64(dataPut["estimasi_transport"].(float64)); val != 750000 {
		t.Errorf("expected estimasi_transport 750000, got %d", val)
	}
}

func TestTrip_WithDokumen(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "google-user", "user@test.com", "user")
	cookie := authCookie(t, userID, "user")
	handler := setupTripRoutes()

	// 1. Create trip with dokumen_url and dokumen_nama
	rec := doRequest(t, handler, "POST", "/api/trips", `{
		"nama": "Monitoring Cimahi",
		"tujuan": "Cimahi, Jawa Barat",
		"tanggal_mulai": "2026-04-08",
		"tanggal_selesai": "2026-04-10",
		"dokumen_url": "trips/test_doc.pdf",
		"dokumen_nama": "692.ST.DBBM.2026 Cimahi 8-10 April 26.pdf"
	}`, cookie)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	body := parseJSON(t, rec)
	data := body["data"].(map[string]interface{})
	tripID := data["id"].(string)

	if data["dokumen_url"] == nil || data["dokumen_url"] != "trips/test_doc.pdf" {
		t.Fatalf("expected dokumen_url 'trips/test_doc.pdf', got %v", data["dokumen_url"])
	}
	if data["dokumen_nama"] == nil || data["dokumen_nama"] != "692.ST.DBBM.2026 Cimahi 8-10 April 26.pdf" {
		t.Fatalf("expected dokumen_nama '692.ST.DBBM.2026 Cimahi 8-10 April 26.pdf', got %v", data["dokumen_nama"])
	}

	// 2. GET trip returns dokumen_url and dokumen_nama
	recGet := doRequest(t, handler, "GET", "/api/trips/"+tripID, "", cookie)
	if recGet.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recGet.Code, recGet.Body.String())
	}
	bodyGet := parseJSON(t, recGet)
	dataGet := bodyGet["data"].(map[string]interface{})
	if dataGet["dokumen_url"] != "trips/test_doc.pdf" {
		t.Errorf("expected dokumen_url 'trips/test_doc.pdf', got %v", dataGet["dokumen_url"])
	}
	if dataGet["dokumen_nama"] != "692.ST.DBBM.2026 Cimahi 8-10 April 26.pdf" {
		t.Errorf("expected dokumen_nama '692.ST.DBBM.2026 Cimahi 8-10 April 26.pdf', got %v", dataGet["dokumen_nama"])
	}
}

func TestParseDocument_JSON(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "google-user", "user@test.com", "user")
	cookie := authCookie(t, userID, "user")
	handler := setupTripRoutes()

	rawText := `
SURAT TUGAS
Nomor : 629/ST/DBBM/2026
Hari, tanggal : Rabu, 8 April 2026 - Jumat, 10 April 2026
Tempat : Cimahi
A. Koordinasi Implementasi Surat Rekomendasi BBM di Kota Cimahi
`
	reqBody := `{"text": "` + strings.ReplaceAll(strings.ReplaceAll(rawText, "\n", "\\n"), "\"", "\\\"") + `"}`
	rec := doRequest(t, handler, "POST", "/api/trips/parse-document", reqBody, cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	body := parseJSON(t, rec)
	data := body["data"].(map[string]interface{})
	if data["doc_type"] != "surat_tugas" {
		t.Errorf("expected doc_type surat_tugas, got %v", data["doc_type"])
	}
	if data["nomor_surat"] != "629/ST/DBBM/2026" {
		t.Errorf("expected 629/ST/DBBM/2026, got %v", data["nomor_surat"])
	}
	if data["tanggal_mulai"] != "2026-04-08" || data["tanggal_selesai"] != "2026-04-10" {
		t.Errorf("expected 2026-04-08..2026-04-10, got %v..%v", data["tanggal_mulai"], data["tanggal_selesai"])
	}
}

func TestParseDocument_PDFAndServe(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "google-user", "user@test.com", "user")
	cookie := authCookie(t, userID, "user")
	handler := setupTripRoutes()

	pdfPath := "/home/maulana/Documents/BPH Migas/692.ST.DBBM.2026 Cimahi 8-10 April 26.pdf"
	pdfContent, err := os.ReadFile(pdfPath)
	if err != nil {
		t.Skipf("sample pdf not available: %v", err)
	}

	// Prepare multipart request
	var b bytes.Buffer
	w := multipart.NewWriter(&b)
	part, err := w.CreateFormFile("file", "692.ST.DBBM.2026 Cimahi 8-10 April 26.pdf")
	if err != nil {
		t.Fatalf("CreateFormFile err: %v", err)
	}
	_, _ = part.Write(pdfContent)
	_ = w.Close()

	req := httptest.NewRequest("POST", "/api/trips/parse-document", &b)
	req.Header.Set("Content-Type", w.FormDataContentType())
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	body := parseJSON(t, rec)
	data := body["data"].(map[string]interface{})

	storedURL := data["dokumen_url"].(string)
	if storedURL == "" {
		t.Fatalf("expected non-empty dokumen_url")
	}
	if data["dokumen_nama"] != "692.ST.DBBM.2026 Cimahi 8-10 April 26.pdf" {
		t.Errorf("expected original filename, got %v", data["dokumen_nama"])
	}

	// Create trip with this storedURL
	recTrip := doRequest(t, handler, "POST", "/api/trips", `{
		"nama": "`+data["nama"].(string)+`",
		"tujuan": "`+data["tujuan"].(string)+`",
		"tanggal_mulai": "`+data["tanggal_mulai"].(string)+`",
		"tanggal_selesai": "`+data["tanggal_selesai"].(string)+`",
		"dokumen_url": "`+storedURL+`",
		"dokumen_nama": "`+data["dokumen_nama"].(string)+`"
	}`, cookie)
	if recTrip.Code != http.StatusCreated {
		t.Fatalf("create trip err: %d: %s", recTrip.Code, recTrip.Body.String())
	}
	tripID := parseJSON(t, recTrip)["data"].(map[string]interface{})["id"].(string)

	// Now download the document via GET /api/trips/{id}/dokumen
	recDoc := doRequest(t, handler, "GET", "/api/trips/"+tripID+"/dokumen", "", cookie)
	if recDoc.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for dokumen, got %d: %s", recDoc.Code, recDoc.Body.String())
	}
	if ct := recDoc.Header().Get("Content-Type"); ct != "application/pdf" {
		t.Errorf("expected Content-Type application/pdf, got %s", ct)
	}
	if recDoc.Body.Len() != len(pdfContent) {
		t.Errorf("expected body length %d, got %d", len(pdfContent), recDoc.Body.Len())
	}

	// Verify unauthorized stranger cannot download
	strangerID := createTestUser(t, "stranger-user", "stranger@test.com", "user")
	strangerCookie := authCookie(t, strangerID, "user")
	recStranger := doRequest(t, handler, "GET", "/api/trips/"+tripID+"/dokumen", "", strangerCookie)
	if recStranger.Code != http.StatusNotFound {
		t.Errorf("expected 404 for unauthorized stranger, got %d", recStranger.Code)
	}
}

func TestWorkspace_CrossUserCollaboration(t *testing.T) {
	cleanupTestData(t)
	userA := createTestUser(t, "user-a", "a@test.com", "user")
	cookieA := authCookie(t, userA, "user")
	userB := createTestUser(t, "user-b", "b@test.com", "user")
	cookieB := authCookie(t, userB, "user")
	stranger := createTestUser(t, "user-c", "c@test.com", "user")
	cookieStranger := authCookie(t, stranger, "user")

	wsA, _ := EnsurePersonalWorkspace(testDB, userA, "User A")
	wsB, _ := EnsurePersonalWorkspace(testDB, userB, "User B")

	handler := setupTripRoutes()

	// 1. User A creates Trip in Workspace A
	reqCreate := httptest.NewRequest("POST", "/api/trips", strings.NewReader(`{
		"nama": "Audit SPBU Surabaya",
		"tujuan": "Surabaya",
		"tanggal_mulai": "2026-05-01",
		"tanggal_selesai": "2026-05-04",
		"uang_dinas": 3000000
	}`))
	reqCreate.Header.Set("Content-Type", "application/json")
	reqCreate.Header.Set("X-Workspace-ID", wsA)
	reqCreate.AddCookie(cookieA)
	recCreate := httptest.NewRecorder()
	handler.ServeHTTP(recCreate, reqCreate)
	if recCreate.Code != http.StatusCreated {
		t.Fatalf("create trip err: %d: %s", recCreate.Code, recCreate.Body.String())
	}
	tripID := parseJSON(t, recCreate)["data"].(map[string]interface{})["id"].(string)

	// 2. Add User B to Workspace A
	_, err := testDB.Exec(`INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'member')`, wsA, userB)
	if err != nil {
		t.Fatalf("add user B to wsA: %v", err)
	}

	// 3. User B lists trips in Workspace A via X-Workspace-ID header
	reqListB := httptest.NewRequest("GET", "/api/trips", nil)
	reqListB.Header.Set("X-Workspace-ID", wsA)
	reqListB.AddCookie(cookieB)
	recListB := httptest.NewRecorder()
	handler.ServeHTTP(recListB, reqListB)
	if recListB.Code != http.StatusOK {
		t.Fatalf("user B list wsA expected 200, got %d: %s", recListB.Code, recListB.Body.String())
	}
	tripsB := parseJSON(t, recListB)["data"].([]interface{})
	if len(tripsB) != 1 {
		t.Fatalf("user B should see 1 trip in wsA, got %d", len(tripsB))
	}
	if tripsB[0].(map[string]interface{})["nama"] != "Audit SPBU Surabaya" {
		t.Errorf("expected Audit SPBU Surabaya, got %v", tripsB[0].(map[string]interface{})["nama"])
	}

	// 4. User B gets single trip details
	reqGetB := httptest.NewRequest("GET", "/api/trips/"+tripID, nil)
	reqGetB.Header.Set("X-Workspace-ID", wsA)
	reqGetB.AddCookie(cookieB)
	recGetB := httptest.NewRecorder()
	handler.ServeHTTP(recGetB, reqGetB)
	if recGetB.Code != http.StatusOK {
		t.Fatalf("user B get trip expected 200, got %d", recGetB.Code)
	}

	// 5. User B switches to their own Workspace B -> should see 0 trips
	reqListOwnB := httptest.NewRequest("GET", "/api/trips", nil)
	reqListOwnB.Header.Set("X-Workspace-ID", wsB)
	reqListOwnB.AddCookie(cookieB)
	recListOwnB := httptest.NewRecorder()
	handler.ServeHTTP(recListOwnB, reqListOwnB)
	if recListOwnB.Code != http.StatusOK {
		t.Fatalf("user B list wsB expected 200, got %d", recListOwnB.Code)
	}
	tripsOwnB := parseJSON(t, recListOwnB)["data"].([]interface{})
	if len(tripsOwnB) != 0 {
		t.Errorf("user B should see 0 trips in wsB, got %d", len(tripsOwnB))
	}

	// 6. Stranger C (not in wsA) tries to access trip -> 404
	reqGetStranger := httptest.NewRequest("GET", "/api/trips/"+tripID, nil)
	reqGetStranger.AddCookie(cookieStranger)
	recGetStranger := httptest.NewRecorder()
	handler.ServeHTTP(recGetStranger, reqGetStranger)
	if recGetStranger.Code != http.StatusNotFound {
		t.Errorf("stranger should get 404, got %d", recGetStranger.Code)
	}
}

