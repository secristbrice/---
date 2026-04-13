import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { WrongQuestionRecord } from "../types";

export const pdfService = {
  async generatePDF(records: WrongQuestionRecord[]) {
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;

    // Create a temporary container for rendering
    const container = document.createElement("div");
    container.style.width = "800px";
    container.style.padding = "40px";
    container.style.backgroundColor = "white";
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.className = "pdf-content";
    document.body.appendChild(container);

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const recordDiv = document.createElement("div");
      recordDiv.style.marginBottom = "40px";
      recordDiv.style.pageBreakAfter = "always";
      
      recordDiv.innerHTML = `
        <h1 style="font-size: 24px; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px;">错题记录 #${i + 1}</h1>
        <div style="margin-bottom: 20px;">
          <h2 style="font-size: 18px; color: #333;">知识点：${record.knowledgePoint}</h2>
          <p style="font-size: 12px; color: #666;">保存时间：${new Date(record.createdAt).toLocaleString()}</p>
        </div>
        
        <div style="margin-bottom: 30px; padding: 15px; border: 1px solid #ddd; border-radius: 8px;">
          <h3 style="font-size: 16px; margin-bottom: 10px; color: #d32f2f;">[原题]</h3>
          <p style="font-size: 14px; line-height: 1.6;">${record.originalQuestion.content}</p>
          ${record.originalQuestion.options?.length ? `<ul style="list-style: none; padding: 0;">${record.originalQuestion.options.map(o => `<li style="margin: 5px 0;">${o}</li>`).join('')}</ul>` : ''}
          <div style="margin-top: 10px; font-size: 14px;">
            <p><strong>我的回答：</strong>${record.originalQuestion.userAnswer || "未填写"}</p>
            <p><strong>标准答案：</strong>${record.originalQuestion.standardAnswer || "未填写"}</p>
          </div>
        </div>

        <div style="margin-bottom: 20px;">
          <h3 style="font-size: 16px; margin-bottom: 15px; color: #1976d2;">[举一反三]</h3>
          ${record.similarQuestions.map((sq, idx) => `
            <div style="margin-bottom: 20px; padding: 10px; border-left: 4px solid #1976d2; background: #f9f9f9;">
              <p style="font-size: 14px; font-weight: bold;">变式题 ${idx + 1}:</p>
              <p style="font-size: 14px; line-height: 1.6;">${sq.content}</p>
              ${sq.options?.length ? `<ul style="list-style: none; padding: 0;">${sq.options.map(o => `<li style="margin: 5px 0;">${o}</li>`).join('')}</ul>` : ''}
              <div style="margin-top: 10px; padding: 10px; background: #fff; border: 1px dashed #ccc;">
                <p style="font-size: 13px;"><strong>正确答案：</strong>${sq.answer}</p>
                <p style="font-size: 13px;"><strong>解析：</strong>${sq.analysis}</p>
                <p style="font-size: 13px; color: #d32f2f;"><strong>易错点：</strong>${sq.commonMistakes}</p>
              </div>
            </div>
          `).join('')}
        </div>
      `;
      container.appendChild(recordDiv);
    }

    try {
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
      });
      
      const imgData = canvas.toDataURL("image/jpeg", 1.0);
      const imgProps = doc.getImageProperties(imgData);
      const pdfHeight = (imgProps.height * contentWidth) / imgProps.width;
      
      // Handle multi-page
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = doc.internal.pageSize.getHeight();

      doc.addImage(imgData, "JPEG", margin, margin, contentWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        doc.addPage();
        doc.addImage(imgData, "JPEG", margin, position + margin, contentWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      doc.save(`错题本_${new Date().toLocaleDateString()}.pdf`);
    } catch (error) {
      console.error("PDF generation failed", error);
    } finally {
      document.body.removeChild(container);
    }
  }
};
