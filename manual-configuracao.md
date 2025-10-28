# Manual de configuracao da atividade

Este documento explica como ajustar cada campo do arquivo `data.json` para personalizar a experiencia do caca-palavras. Todas as configuracoes sao opcionais, exceto as palavras (ou dicas) e o modo de jogo.

## Estrutura geral

```json
{
  "mode": "dica",
  "taskDescription": "...",
  "wordList": [ ... ],
  "behaviour": { ... },
  "accessibility": { ... },
  "l10n": { ... }
}
```

- `mode`: define o tipo de jogo.
  - `"palavra"` mostra diretamente a lista de palavras a serem encontradas.
  - `"dica"` exibe apenas dicas; a palavra real so aparece depois que o jogador encontra a resposta na grade. Neste modo, cada item da lista precisa de um campo `hint`.
- `taskDescription` (texto): mensagem exibida no topo da tela, antes da grade. Use para orientar o jogador sobre a tarefa.

## wordList

Lista de palavras ou de pares palavra/dica. A interpretacao varia conforme o modo:

- **Modo palavra**
  ```json
  "wordList": ["cachorro", "gato", "passaro"]
  ```
  ou
  ```json
  "wordList": [
    { "word": "cachorro" },
    { "word": "gato" }
  ]
  ```

- **Modo dica**
  ```json
  "wordList": [
    { "word": "cachorro", "hint": "Melhor amigo do homem" },
    { "word": "gato", "hint": "Gostam de dormir em lugares altos" }
  ]
  ```

Regras gerais:
- As palavras podem usar letras maiusculas ou minusculas; o script normaliza tudo para maiusculas.
- Nao repita palavras; duplicatas sao ignoradas.
- Evite caracteres especiais nas palavras (apenas letras A-Z). As dicas podem conter qualquer caractere.

## behaviour

Controla como o tabuleiro e montado e quais botoes aparecem:

```json
"behaviour": {
  "orientations": { ... },
  "fillPool": "abcdefghijklmnopqrstuvwxyz",
  "preferOverlap": true,
  "showVocabulary": true,
  "enableShowSolution": true,
  "enableRetry": true,
  "timeLimitSeconds": 0
}
```

- `orientations`: ativa ou desativa direcoes para posicionar palavras. Defina `true` ou `false` para:
  - `horizontal`: esquerda -> direita
  - `horizontalBack`: direita -> esquerda
  - `vertical`: cima -> baixo
  - `verticalUp`: baixo -> cima
  - `diagonal`: diagonal descendo esquerda -> direita
  - `diagonalBack`: diagonal descendo direita -> esquerda
  - `diagonalUp`: diagonal subindo esquerda -> direita
  - `diagonalUpBack`: diagonal subindo direita -> esquerda
- `fillPool`: conjunto de letras usado para preencher espacos vazios. Apenas letras A-Z sao validas; o script converte para maiusculas.
- `preferOverlap`: quando `true`, a geracao tenta sobrepor letras em comum entre palavras, tornando a grade mais compacta.
- `showVocabulary`: exibe (true) ou oculta (false) a coluna lateral de palavras/dicas. No modo `dica` sempre sera `true`.
- `enableShowSolution`: controla se o botao "Mostrar solucao" aparece.
- `enableRetry`: controla se o botao "Repetir" aparece, permitindo gerar uma nova grade.
- `timeLimitSeconds`: limite de tempo em segundos para concluir a atividade. Use `0` ou omita o campo para desativar o cronometro regressivo. Ao atingir o limite, a atividade bloqueia as interacoes e exibe uma modal oferecendo reinicio.

## accessibility

Configura recursos complementares de acessibilidade.

```json
"accessibility": {
  "vlibras": {
    "desktop": false,
    "mobile": false
  }
}
```

- `vlibras.desktop`: ativa (`true`) ou desativa (`false`) o widget VLibras para navegadores desktop.
- `vlibras.mobile`: ativa ou desativa o widget em navegadores mobile. O widget pode impactar desempenho em telas pequenas, por isso a configuracao separada.
- Com o VLibras ativo, prefira textos curtos e objetivos em `taskDescription`, `wordList` (dicas) e `l10n` para facilitar a traducao do interprete virtual.

## l10n (textos da interface)

Permite personalizar labels e mensagens. Todos os campos sao opcionais; se omitidos, os padroes internos sao usados.

```json
"l10n": {
  "check": "Corrigir",
  "tryAgain": "Repetir",
  "showSolution": "Mostrar solucao",
  "found": "@found de @totalWords descobertas",
  "timeSpent": "Tempo gasto",
  "score": "Voce descobriu @score de @total palavras",
  "wordListHeader": "Dicas"
}
```

- `check`: texto do botao principal (mostra o placar atual).
- `tryAgain`: texto do botao de reiniciar.
- `showSolution`: texto do botao que revela todas as respostas.
- `found`: mensagem do contador lateral. Use `@found` e `@totalWords` para inserir os numeros dinamicos.
- `timeSpent`: legenda exibida acima do relogio.
- `score`: mensagem apresentada depois de "Corrigir" ou ao terminar o jogo. Use `@score` (palavras encontradas) e `@total`.
- `wordListHeader`: titulo da coluna lateral de palavras ou dicas.

## Checklist rapido

1. Escolha o modo (`palavra` ou `dica`).
2. Preencha `wordList` no formato correspondente ao modo.
3. Ajuste `behaviour` conforme as direcoes e botoes desejados.
4. Defina `accessibility.vlibras` conforme o publico-alvo e os dispositivos suportados.
5. Personalize os textos em `l10n`, se necessario.
6. Atualize `taskDescription` para orientar os jogadores.

Com isso, a atividade estara pronta para ser servida em qualquer VPS que suporte arquivos estaticos (HTML, CSS, JS e JSON).
