package model

import "testing"

func TestValidStatuses(t *testing.T) {
	for _, s := range []string{"berlangsung", "selesai", "diajukan", "lunas"} {
		if !ValidStatuses[s] {
			t.Errorf("expected %q to be valid", s)
		}
	}
	if ValidStatuses["urus_berkas"] {
		t.Error("urus_berkas should not be valid anymore")
	}
}
