//! Text normalisation shared by the index builder and the query path.
//!
//! Lowercases, strips diacritics ("Großglockner" -> "grossglockner",
//! "Mönchsberg" -> "monchsberg") and splits on anything that is not a letter
//! or digit.

use unicode_normalization::{UnicodeNormalization, char::is_combining_mark};

/// Normalises `s` and returns its tokens.
pub fn tokens(s: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut cur = String::new();
    for c in s.nfkd() {
        if is_combining_mark(c) {
            continue;
        }
        if c.is_alphanumeric() {
            push_folded(c, &mut cur);
        } else if !cur.is_empty() {
            out.push(std::mem::take(&mut cur));
        }
    }
    if !cur.is_empty() {
        out.push(cur);
    }
    out
}

/// Characters that NFKD does not decompose but users type without accents.
fn push_folded(c: char, out: &mut String) {
    match c {
        'ß' | 'ẞ' => out.push_str("ss"),
        'æ' | 'Æ' => out.push_str("ae"),
        'œ' | 'Œ' => out.push_str("oe"),
        'ø' | 'Ø' => out.push('o'),
        'ł' | 'Ł' => out.push('l'),
        'đ' | 'Đ' | 'ð' | 'Ð' => out.push('d'),
        'þ' | 'Þ' => out.push_str("th"),
        'ı' => out.push('i'),
        _ => out.extend(c.to_lowercase()),
    }
}

/// The first `n` characters of `s` (not bytes).
pub fn char_prefix(s: &str, n: usize) -> Option<&str> {
    match s.char_indices().nth(n) {
        Some((end, _)) => Some(&s[..end]),
        None if s.chars().count() == n => Some(s),
        None => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn folds_and_splits() {
        assert_eq!(tokens("Großglockner"), ["grossglockner"]);
        assert_eq!(tokens("Coll d'Anrodat"), ["coll", "d", "anrodat"]);
        assert_eq!(tokens("St. Moritz – Bahnhof"), ["st", "moritz", "bahnhof"]);
        assert_eq!(tokens("Øresund Łódź"), ["oresund", "lodz"]);
        assert_eq!(tokens("東京都"), ["東京都"]);
    }

    #[test]
    fn prefixes_by_char() {
        assert_eq!(char_prefix("öbb", 1), Some("ö"));
        assert_eq!(char_prefix("ab", 2), Some("ab"));
        assert_eq!(char_prefix("ab", 3), None);
    }
}
