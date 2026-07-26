# -*- coding: utf-8 -*-
# Reliable fullwidth-punctuation fixer (heredocs mangle CJK punctuation).
import io

FULL_COLON = '：'   # :
HALF_COLON = ':'
L_QUOTE = '「'      # 「
R_QUOTE = '」'      # 」

for p in ['src/data/mock.ts', 'src/i18n.tsx']:
    with io.open(p, encoding='utf-8') as f:
        s = f.read()
    before = s.count('示例' + HALF_COLON)  # 示例:
    s = s.replace('示例' + HALF_COLON, '示例' + FULL_COLON)
    s = s.replace('"委派给 Agent"', L_QUOTE + '委派给 Agent' + R_QUOTE)
    with io.open(p, 'w', encoding='utf-8') as f:
        f.write(s)
    after_half = s.count('示例' + HALF_COLON)
    after_full = s.count('示例' + FULL_COLON)
    print(p, 'half:', before, '->', after_half, '| full now:', after_full)
