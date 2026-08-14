function drawSpacedText(ctx, text, x, y, spacing, isCenter, weight) {
  if (!text) return;
  var cx = x; 
  var margin = DESIGN.margin + 4;
  var maxWidth = ctx.canvas.width - (margin * 2);

  if (isCenter) {
    var totalW = 0; 
    for (var i=0; i<text.length; i++) totalW += ctx.measureText(text[i]).width + (spacing||0);
    totalW -= (spacing||0);
    
    if (totalW > maxWidth) {
      totalW = 0; 
      var safeSpacing = 0; 
      for (var i=0; i<text.length; i++) totalW += ctx.measureText(text[i]).width + safeSpacing;
      totalW -= safeSpacing;
    }
    cx = x - totalW / 2;
  }

  for (var j=0; j<text.length; j++) {
    var charW = ctx.measureText(text[j]).width;
    if (cx + charW > ctx.canvas.width - margin) {
      boldText(ctx, '…', cx, y, weight);
      break; 
    }
    boldText(ctx, text[j], cx, y, weight);
    cx += charW + (spacing||0);
  }
}
