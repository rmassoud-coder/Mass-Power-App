/**
 * البحث عن سعة زيت المحرك (مع تغيير الفلتر)، باللتر.
 * تم تجميعها للسيارات الشائعة في ورش السيارات في الشرق الأوسط.
 * يتم المطابقة من خلال البحث عن النص (غير حساس لحالة الأحرف) في سلسلة make + model.
 * في حالة عدم وجود تطابق، يتم إرجاع undefined لإخفاء القيمة أو عرض "غير متوفر".
 *
 * ملاحظة دقة: الأرقام أدناه هي قيم شائعة/منشورة تقريبية وقد تختلف قليلاً
 * حسب سنة الصنع أو نوع المحرك المحدد داخل نفس الموديل. يُفضّل التأكد من
 * كتيّب الصيانة عند الحاجة لدقة تامة، خصوصاً للموديلات الأحدث.
 */

interface OilEntry {
  /** النص(النصوص) الفرعية (غير حساسة لحالة الأحرف) التي يجب أن تظهر جميعها في `${make} ${model}` */
  match: string[];
  litres: number;
  note?: string;
  /**
   * ✅ جديد: يُستخدم لتمييز أسماء "الفئة" العامة (مثل "e-class"، "3 series")
   * التي قد تتطابق أيضاً مع نص أي طراز فرعي أكثر تحديداً ضمن نفس الفئة
   * (مثل "e350"، "320"). المدخلات العامة تُفحص دائماً بعد المدخلات
   * المحددة، بدل الاعتماد على ترتيب هش حسب طول النص (كان يُخطئ سابقاً
   * ويُفضّل "e-class" على "e350" في بعض الحالات).
   */
  generic?: boolean;
}

const TABLE: OilEntry[] = [
  // --- مرسيدس-بنز ---
  { match: ['mercedes', 'c-class'], litres: 6.5, generic: true },
  { match: ['mercedes', 'c200'], litres: 5.5 },
  { match: ['mercedes', 'c300'], litres: 5.8 },
  { match: ['mercedes', 'e-class'], litres: 6.5, generic: true },
  { match: ['mercedes', 'e200'], litres: 5.8 },
  { match: ['mercedes', 'e350'], litres: 8.0 },
  { match: ['mercedes', 'e500'], litres: 8.5 },
  { match: ['mercedes', 's-class'], litres: 8.5 },
  { match: ['mercedes', 'clk'], litres: 7.5 },
  { match: ['mercedes', 'cls'], litres: 8.0 },
  { match: ['mercedes', 'glc'], litres: 6.0 },
  { match: ['mercedes', 'gle'], litres: 8.5 },
  { match: ['mercedes', 'ml'], litres: 8.5 },
  { match: ['mercedes', 'gls'], litres: 8.5 },
  { match: ['mercedes', 'g-class'], litres: 9.0 },
  { match: ['mercedes', 'a-class'], litres: 5.4 },
  { match: ['mercedes', 'b-class'], litres: 5.4 },
  { match: ['mercedes', 'sprinter'], litres: 11.5 },
  { match: ['mercedes', 'vito'], litres: 6.5 },

  // --- بي إم دبليو ---
  { match: ['bmw', '3 series'], litres: 4.25, generic: true },
  { match: ['bmw', '320'], litres: 4.25 },
  { match: ['bmw', '328'], litres: 5.2 },
  { match: ['bmw', '5 series'], litres: 6.5, generic: true },
  { match: ['bmw', '520'], litres: 5.2 },
  { match: ['bmw', '525'], litres: 7.0 },
  { match: ['bmw', '528'], litres: 5.2 },
  { match: ['bmw', '530'], litres: 6.5 },
  { match: ['bmw', '535'], litres: 6.5 },
  { match: ['bmw', '7 series'], litres: 7.0, generic: true },
  { match: ['bmw', '740'], litres: 7.0 },
  { match: ['bmw', '750'], litres: 8.5 },
  { match: ['bmw', 'x1'], litres: 5.0 },
  { match: ['bmw', 'x3'], litres: 6.5 },
  { match: ['bmw', 'x5'], litres: 6.5 },
  { match: ['bmw', 'x6'], litres: 8.5 },
  { match: ['bmw', 'x7'], litres: 8.5 },

  // --- تويوتا / لكزس ---
  { match: ['toyota', 'corolla'], litres: 4.4 },
  { match: ['toyota', 'camry'], litres: 4.7 },
  { match: ['toyota', 'yaris'], litres: 3.7 },
  { match: ['toyota', 'rav4'], litres: 4.4 },
  { match: ['toyota', 'hilux'], litres: 7.5 },
  { match: ['toyota', 'land cruiser'], litres: 8.0 },
  { match: ['toyota', 'prado'], litres: 6.5 },
  { match: ['toyota', 'fortuner'], litres: 6.7 },
  { match: ['toyota', 'hiace'], litres: 7.4 },
  { match: ['toyota', 'avanza'], litres: 3.7 },
  { match: ['toyota', 'innova'], litres: 5.5 },
  { match: ['lexus', 'es'], litres: 5.7 },
  { match: ['lexus', 'is'], litres: 5.5 },
  { match: ['lexus', 'rx'], litres: 6.4 },
  { match: ['lexus', 'lx'], litres: 7.6 },
  { match: ['lexus', 'gx'], litres: 6.0 },

  // --- هوندا / أكورا ---
  { match: ['honda', 'civic'], litres: 3.7 },
  { match: ['honda', 'accord'], litres: 4.4 },
  { match: ['honda', 'cr-v'], litres: 4.2 },
  { match: ['honda', 'pilot'], litres: 4.5 },
  { match: ['honda', 'odyssey'], litres: 4.5 },

  // --- نيسان / إنفينيتي ---
  { match: ['nissan', 'sunny'], litres: 3.4 },
  { match: ['nissan', 'altima'], litres: 4.6 },
  { match: ['nissan', 'maxima'], litres: 4.8 },
  { match: ['nissan', 'patrol'], litres: 6.9 },
  { match: ['nissan', 'x-trail'], litres: 4.4 },
  { match: ['nissan', 'qashqai'], litres: 4.3 },
  { match: ['nissan', 'navara'], litres: 5.2 },
  { match: ['infiniti', 'qx'], litres: 5.4 },

  // --- هيونداي / كيا / جينيسيس ---
  { match: ['hyundai', 'elantra'], litres: 4.0 },
  { match: ['hyundai', 'sonata'], litres: 4.5 },
  { match: ['hyundai', 'accent'], litres: 3.6 },
  { match: ['hyundai', 'tucson'], litres: 4.0 },
  { match: ['hyundai', 'santa fe'], litres: 5.7 },
  { match: ['hyundai', 'h1'], litres: 6.7 },
  { match: ['kia', 'cerato'], litres: 4.0 },
  { match: ['kia', 'sportage'], litres: 4.2 },
  { match: ['kia', 'sorento'], litres: 5.7 },
  { match: ['kia', 'optima'], litres: 4.5 },
  { match: ['kia', 'rio'], litres: 3.6 },

  // --- ميتسوبيشي ---
  { match: ['mitsubishi', 'lancer'], litres: 4.3 },
  { match: ['mitsubishi', 'pajero'], litres: 5.5 },
  { match: ['mitsubishi', 'outlander'], litres: 4.3 },
  { match: ['mitsubishi', 'l200'], litres: 6.5 },

  // --- فورد / شيفروليه / جي إم سي ---
  { match: ['ford', 'focus'], litres: 4.1 },
  { match: ['ford', 'fusion'], litres: 5.7 },
  { match: ['ford', 'explorer'], litres: 5.7 },
  { match: ['ford', 'f-150'], litres: 6.6 },
  { match: ['ford', 'edge'], litres: 5.7 },
  { match: ['chevrolet', 'spark'], litres: 3.5 },
  { match: ['chevrolet', 'cruze'], litres: 4.7 },
  { match: ['chevrolet', 'tahoe'], litres: 6.6 },
  { match: ['chevrolet', 'suburban'], litres: 6.6 },
  { match: ['chevrolet', 'malibu'], litres: 4.7 },
  { match: ['gmc', 'yukon'], litres: 6.6 },

  // --- أودي / فولكس فاجن / بورش ---
  { match: ['audi', 'a3'], litres: 4.5 },
  { match: ['audi', 'a4'], litres: 5.7 },
  { match: ['audi', 'a6'], litres: 5.7 },
  { match: ['audi', 'a8'], litres: 8.5 },
  { match: ['audi', 'q3'], litres: 4.6 },
  { match: ['audi', 'q5'], litres: 6.8 },
  { match: ['audi', 'q7'], litres: 8.5 },
  { match: ['volkswagen', 'golf'], litres: 4.2 },
  { match: ['volkswagen', 'passat'], litres: 4.5 },
  { match: ['volkswagen', 'tiguan'], litres: 5.7 },
  { match: ['porsche', 'cayenne'], litres: 8.5 },
  { match: ['porsche', 'macan'], litres: 6.5 },

  // --- لاند روفر / جاغوار ---
  { match: ['land rover', 'range rover'], litres: 8.0 },
  { match: ['land rover', 'discovery'], litres: 8.0 },
  { match: ['jaguar', 'xf'], litres: 7.5 },
  { match: ['jaguar', 'xj'], litres: 7.5 },

  // --- سيارات شائعة جداً في لبنان ---
  // ملاحظة: ميتسوبيشي أتراج/ميراج من أكثر السيارات انتشاراً في السوق
  // اللبناني، وكذلك دودج تشارجر وكرايسلر 300 (نفس محرك البنتاستار V6
  // في أغلب الفئات الشائعة محلياً).
  { match: ['mitsubishi', 'attrage'], litres: 3.0 },
  { match: ['mitsubishi', 'mirage'], litres: 3.0 },

  { match: ['renault', 'duster'], litres: 4.0 },
  { match: ['renault', 'clio'], litres: 4.2 },
  { match: ['renault', 'symbol'], litres: 4.2 },
  { match: ['renault', 'logan'], litres: 4.2 },
  { match: ['renault', 'megane'], litres: 4.5 },

  { match: ['peugeot', '301'], litres: 4.0 },
  { match: ['peugeot', '3008'], litres: 4.5 },
  { match: ['peugeot', '508'], litres: 4.5 },
  { match: ['citroen', 'c3'], litres: 4.0 },
  { match: ['citroen', 'c4'], litres: 4.2 },

  { match: ['chevrolet', 'optra'], litres: 4.0 },
  { match: ['chevrolet', 'aveo'], litres: 3.5 },
  { match: ['daewoo', 'lanos'], litres: 3.5 },
  { match: ['daewoo', 'nexia'], litres: 3.5 },

  { match: ['suzuki', 'alto'], litres: 2.7 },
  { match: ['suzuki', 'swift'], litres: 3.2 },
  { match: ['suzuki', 'vitara'], litres: 3.8 },

  { match: ['skoda', 'octavia'], litres: 4.3 },
  { match: ['skoda', 'fabia'], litres: 3.3 },
  { match: ['seat', 'ibiza'], litres: 3.6 },
  { match: ['seat', 'leon'], litres: 4.3 },
  { match: ['fiat', 'tipo'], litres: 4.3 },
  { match: ['fiat', 'punto'], litres: 3.3 },

  { match: ['hyundai', 'i10'], litres: 2.8 },
  { match: ['hyundai', 'i20'], litres: 3.3 },
  { match: ['hyundai', 'i30'], litres: 4.0 },

  // جيب في السوق اللبناني — "grand cherokee" مذكورة قبل "cherokee" العادية
  // عمداً كي لا يتم الخلط بينهما (كلاهما يحتوي على النص "cherokee").
  { match: ['jeep', 'grand cherokee'], litres: 5.7 },
  { match: ['jeep', 'cherokee'], litres: 5.2 },
  { match: ['jeep', 'wrangler'], litres: 5.7 },
  { match: ['jeep', 'compass'], litres: 5.0 },

  { match: ['dodge', 'charger'], litres: 5.7 },
  { match: ['chrysler', '300'], litres: 5.7 },
];

/** البحث عن سعة الزيت المقترحة بناءً على صنع وطراز المركبة.
 *  يتم إرجاع undefined في حالة عدم وجود تطابق. */
export function suggestOilLitres(
  make?: string | null,
  model?: string | null
): { litres: number; matchedKey: string } | undefined {
  if (!make && !model) return undefined;
  const haystack = `${(make || '').toLowerCase()} ${(model || '').toLowerCase()}`;

  // ✅ الإصلاح: نفحص المدخلات المحددة (غير العامة) أولاً بترتيب ظهورها
  // في الجدول، ثم مدخلات "الفئة" العامة (generic) في النهاية فقط كحل
  // احتياطي. سابقاً كان الترتيب يعتمد على طول النص الإجمالي، وهذا كان
  // أحياناً يُفضّل اسم الفئة العام (مثل "e-class") على الطراز المحدد
  // فعلياً (مثل "e350") — وهو عكس المطلوب تماماً.
  const specific = TABLE.filter((e) => !e.generic);
  const generic = TABLE.filter((e) => e.generic);

  for (const entry of [...specific, ...generic]) {
    if (entry.match.every((m) => haystack.includes(m))) {
      return { litres: entry.litres, matchedKey: entry.match.join(' / ') };
    }
  }
  return undefined;
}
