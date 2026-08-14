(function () {
  const form = document.getElementById("regForm");
  const isMember = document.getElementById("isMember");
  const registrationType = document.getElementById("registrationType");
  const member2Section = document.getElementById("member2Section");
  const hasKidsUnder16 = document.getElementById("hasKidsUnder16");
  const kidsCountField = document.getElementById("kidsCountField");
  const kidsCountInput = document.getElementById("kidsCount");
  const childrenFields = document.getElementById("childrenFields");
  const childTemplate = document.getElementById("childFieldTemplate");
  const priceDisplay = document.getElementById("priceDisplay");
  const priceBreakdown = document.getElementById("priceBreakdown");
  const formError = document.getElementById("formError");
  const submitBtn = document.getElementById("submitBtn");
  const submitBtnText = document.getElementById("submitBtnText");

  const todayStr = new Date().toISOString().split("T")[0];

  function currentValues() {
    return {
      isMember: isMember.value,
      registrationType: registrationType.value,
      kidsCount: kidsCountField.hidden ? 0 : (kidsCountInput.value || 0)
    };
  }

  function calculateAge(birthDateStr) {
    const today = new Date();
    const birth = new Date(birthDateStr);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }

  // ---------- بناء كارت طفل واحد من القالب ----------
  function buildChildBlock(index) {
    const clone = childTemplate.content.cloneNode(true);
    const block = clone.querySelector(".child-block");
    block.querySelector(".child-block__title").textContent = `الطفل رقم ${index + 1}`;

    const birthdateInput = block.querySelector(".child-birthdate");
    birthdateInput.max = todayStr;
    birthdateInput.name = `child_${index}_birthdate`;

    const ageDisplay = block.querySelector(".child-block__age");
    const confirmField = block.querySelector(".child-confirm-field");
    const confirmInput = block.querySelector(".child-age-confirm");
    confirmInput.name = `child_${index}_ageConfirm`;
    const confirmError = block.querySelector(".child-confirm-error");

    birthdateInput.addEventListener("change", () => {
      confirmInput.value = "";
      confirmInput.classList.remove("mismatch");
      confirmError.classList.remove("show");
      confirmError.hidden = true;

      if (!birthdateInput.value) {
        ageDisplay.hidden = true;
        confirmField.hidden = true;
        return;
      }
      const age = calculateAge(birthdateInput.value);
      if (age < 0) {
        ageDisplay.textContent = "تاريخ غير صحيح (في المستقبل)";
        ageDisplay.classList.add("warn");
        ageDisplay.hidden = false;
        confirmField.hidden = true;
        return;
      }
      ageDisplay.classList.toggle("warn", age >= 16);
      ageDisplay.textContent = age >= 16
        ? `العمر المحسوب: ${age} سنة — ده أكبر من 16! تأكد من التاريخ`
        : `العمر المحسوب: ${age} سنة`;
      ageDisplay.hidden = false;
      confirmField.hidden = false;
      confirmInput.dataset.expectedAge = age;
    });

    confirmInput.addEventListener("input", () => {
      const expected = Number(confirmInput.dataset.expectedAge);
      const matches = Number(confirmInput.value) === expected && confirmInput.value !== "";
      confirmInput.classList.toggle("mismatch", confirmInput.value !== "" && !matches);
      confirmError.classList.toggle("show", confirmInput.value !== "" && !matches);
      confirmError.hidden = matches || confirmInput.value === "";
    });

    return block;
  }

  function renderChildrenFields() {
    const count = Math.max(1, Math.min(10, Number(kidsCountInput.value) || 1));
    childrenFields.innerHTML = "";
    for (let i = 0; i < count; i++) {
      childrenFields.appendChild(buildChildBlock(i));
    }
  }

  function updateConditionalFields() {
    const isFamily = registrationType.value === "family";
    member2Section.hidden = !isFamily;
    form.member2_name.required = isFamily;
    form.member2_gender.required = isFamily;
    form.member2_email.required = isFamily;
    form.member2_phone.required = isFamily;

    const hasKids = hasKidsUnder16.value === "yes";
    kidsCountField.hidden = !hasKids;
    kidsCountInput.required = hasKids;

    if (!hasKids) {
      // نسيب الحقل فاضي تمامًا (مش نحط فيه 0) عشان متعارضش مع شرط
      // "min=1" بتاعه — لو حطينا 0 والحقل مختفي، الفورم كان بيرفض
      // الإرسال بصمت من غير ما يوري أي رسالة، لأن المتصفح مش بيقدر
      // يعرض تحذير على حقل مش ظاهر أصلاً.
      kidsCountInput.value = "";
      childrenFields.innerHTML = "";
    } else {
      if (!kidsCountInput.value || Number(kidsCountInput.value) < 1) kidsCountInput.value = 1;
      renderChildrenFields();
    }
  }

  function updatePrice() {
    const values = currentValues();
    if (!values.isMember || !values.registrationType) {
      priceDisplay.textContent = "— kr";
      priceBreakdown.textContent = "أكمل بيانات نوع التسجيل عشان يظهر المبلغ";
      return;
    }
    const total = calculatePriceNOK(values);
    priceDisplay.textContent = total + " kr";
    const label = values.registrationType === "family" ? "تسجيل عائلي" : "تسجيل فردي";
    const memberLabel = values.isMember === "yes" ? "عضو 2026" : "غير عضو";
    priceBreakdown.textContent = `${label} · ${memberLabel}` + (values.kidsCount > 0 ? ` · ${values.kidsCount} طفل` : "");
  }

  [isMember, registrationType, hasKidsUnder16].forEach(el => {
    el.addEventListener("change", () => { updateConditionalFields(); updatePrice(); });
  });
  kidsCountInput.addEventListener("change", () => { renderChildrenFields(); updatePrice(); });

  // ---------- تحقق شامل من كل كروت الأطفال قبل الإرسال ----------
  function validateChildrenFields() {
    if (kidsCountField.hidden) return { valid: true };

    const blocks = childrenFields.querySelectorAll(".child-block");
    const birthdates = [];
    const ages = [];

    for (const block of blocks) {
      const birthdateInput = block.querySelector(".child-birthdate");
      const confirmInput = block.querySelector(".child-age-confirm");

      if (!birthdateInput.value) {
        return { valid: false, message: "لازم تدخل تاريخ ميلاد كل طفل." };
      }
      const age = calculateAge(birthdateInput.value);
      if (age < 0) {
        return { valid: false, message: "تاريخ ميلاد أحد الأطفال غير صحيح." };
      }
      if (confirmInput.value === "" || Number(confirmInput.value) !== age) {
        return { valid: false, message: "لازم تأكد عمر كل طفل بشكل صحيح قبل الاستمرار." };
      }
      birthdates.push(birthdateInput.value);
      ages.push(age);
    }

    return { valid: true, birthdates, ages };
  }

  const FIELD_LABELS = {
    isMember: "هل أنت عضو",
    registrationType: "نوع التسجيل",
    member1_name: "اسم العضو",
    member1_gender: "جنس العضو",
    member1_email: "بريد العضو الإلكتروني",
    member1_phone: "هاتف العضو",
    member2_name: "اسم العضو الثاني",
    member2_gender: "جنس العضو الثاني",
    member2_email: "بريد العضو الثاني",
    member2_phone: "هاتف العضو الثاني",
    hasKidsUnder16: "سؤال الأطفال",
    kidsCount: "عدد الأطفال"
  };

  function findInvalidFieldsMessage() {
    const invalid = Array.from(form.elements).filter(
      el => typeof el.checkValidity === "function" && !el.checkValidity()
    );
    if (!invalid.length) return null;
    const names = invalid.map(el => {
      const base = FIELD_LABELS[el.name] || el.name || el.id || "حقل غير معروف";
      return el.offsetParent === null ? `${base} (حقل مختفي — تواصل مع منظّمي الفورم)` : base;
    });
    return "فيه مشكلة في: " + [...new Set(names)].join("، ");
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    formError.hidden = true;

    if (!form.checkValidity()) {
      const diagnosticMessage = findInvalidFieldsMessage();
      showError(diagnosticMessage || "فيه بيانات ناقصة أو غير صحيحة في الفورم.");
      form.reportValidity();
      return;
    }
    if (!form.agreeTerms.checked) {
      showError("لازم توافق على الشروط والأحكام قبل الاستمرار.");
      return;
    }
    if (!form.agreeDataUse.checked) {
      showError("لازم توافق على استخدام بياناتك قبل الاستمرار.");
      return;
    }

    const childrenCheck = validateChildrenFields();
    if (!childrenCheck.valid) {
      showError(childrenCheck.message);
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());
    data.agreeTerms = form.agreeTerms.checked;
    data.agreeDataUse = form.agreeDataUse.checked;

    if (childrenCheck.birthdates) {
      data.childBirthdates = JSON.stringify(childrenCheck.birthdates);
      data.childAges = JSON.stringify(childrenCheck.ages);
    }

    setLoading(true);
    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "حصل خطأ أثناء تجهيز الدفع، حاول تاني.");
      }

      const { url } = await res.json();
      if (!url) throw new Error("لم يتم استلام رابط الدفع.");
      window.location.href = url; // redirect to Stripe Checkout
    } catch (err) {
      showError(err.message || "حصل خطأ غير متوقع، حاول تاني.");
      setLoading(false);
    }
  });

  function showError(msg) {
    formError.textContent = msg;
    formError.hidden = false;
    formError.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtnText.textContent = isLoading ? "جاري التجهيز..." : "المتابعة إلى الدفع";
  }

  updateConditionalFields();
  updatePrice();
})();
