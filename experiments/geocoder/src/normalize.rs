//! Text folding shared by the index builder and the query path, so both
//! sides always agree on what a token is.

use unicode_normalization::UnicodeNormalization;
use unicode_normalization::char::is_combining_mark;

/// Longest token kept, in bytes. Longer ones are cut at a char boundary.
pub const MAX_TOKEN_BYTES: usize = 48;

/// Lowercases, strips diacritics and splits on anything that isn't a letter
/// or digit. `"Zürich-Höngg"` becomes `["zurich", "hongg"]`.
#[must_use]
pub fn tokens(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut cur = String::new();
    for c in text.nfkd() {
        if is_combining_mark(c) {
            continue;
        }
        if c.is_alphanumeric() {
            match c {
                'ß' => cur.push_str("ss"),
                'ø' | 'Ø' => cur.push('o'),
                'æ' | 'Æ' => cur.push_str("ae"),
                'œ' | 'Œ' => cur.push_str("oe"),
                'đ' | 'Đ' | 'ð' | 'Ð' => cur.push('d'),
                'ł' | 'Ł' => cur.push('l'),
                'ı' => cur.push('i'),
                'þ' | 'Þ' => cur.push_str("th"),
                _ => cur.extend(c.to_lowercase()),
            }
        } else if !cur.is_empty() {
            out.push(truncate(std::mem::take(&mut cur)));
        }
    }
    if !cur.is_empty() {
        out.push(truncate(cur));
    }
    out
}

fn truncate(mut token: String) -> String {
    if token.len() > MAX_TOKEN_BYTES {
        let mut end = MAX_TOKEN_BYTES;
        while !token.is_char_boundary(end) {
            end -= 1;
        }
        token.truncate(end);
    }
    token
}

/// The folded form of a whole name, tokens joined by single spaces.
#[must_use]
pub fn folded(text: &str) -> String {
    tokens(text).join(" ")
}
