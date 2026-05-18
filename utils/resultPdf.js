const PDFDocument = require('pdfkit');

function generateResultPdf(student, session, term, results, grades, avgScore, attendanceRate, classPosition, totalStudents, verificationCode, school) {
  school = school || { school_name: 'SCHOOL NAME', school_short_name: 'SIMS' };
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const buffers = [];
  doc.on('data', b => buffers.push(b));

  const pageWidth = doc.page.width - 100;
  const leftX = 50;
  const rightX = doc.page.width - 50;

  const totalUnits = results.length;
  const totalScore = results.reduce((sum, r) => sum + r.total, 0);
  const maxTotal = results.length * 100;

  function header() {
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#1a3a5c')
      .text(school.school_name, { align: 'center' });
    doc.fontSize(10).font('Helvetica').fillColor('#555')
      .text(school.school_short_name + ' - Student Information Management System', { align: 'center' });
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#1a3a5c')
      .text('OFFICIAL SEMESTER RESULT', { align: 'center' });
    doc.moveDown(0.5);
    doc.strokeColor('#1a3a5c').lineWidth(1).moveTo(leftX, doc.y).lineTo(rightX, doc.y).stroke();
    doc.moveDown(1);
  }

  function infoAndSummary() {
    const startY = doc.y;
    const colWidth = pageWidth / 2 - 10;
    const leftColX = leftX;
    const rightColX = leftX + colWidth + 20;

    const info = [
      ['Student Name:', `${student.first_name} ${student.middle_name ? student.middle_name + ' ' : ''}${student.last_name}`],
      ['Reg No:', student.reg_no],
      ['Class:', `${student.class_name} ${student.class_arm}`],
      ['Term:', term ? term.name : 'N/A'],
      ['Session:', session ? session.name : 'N/A'],
    ];

    const summaryData = [
      ['Total Subjects:', totalUnits.toString()],
      ['Total Score:', `${totalScore}/${maxTotal}`],
      ['Average:', `${avgScore}%`],
      ['Attendance Rate:', `${attendanceRate}%`],
      ['Class Position:', classPosition > 0 ? `${classPosition} of ${totalStudents}` : 'N/A'],
    ];

    info.forEach((row, i) => {
      const yPos = startY + i * 18;
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#333');
      doc.text(row[0], leftColX, yPos, { continued: true, width: colWidth });
      doc.font('Helvetica').text(`  ${row[1]}`, { width: colWidth });
    });

    summaryData.forEach((row, i) => {
      const yPos = startY + i * 18;
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#333');
      doc.text(row[0], rightColX, yPos, { continued: true, width: colWidth });
      doc.font('Helvetica').text(`  ${row[1]}`, { width: colWidth });
    });

    const maxRows = Math.max(info.length, summaryData.length);
    doc.y = startY + maxRows * 18 + 10;
  }

  function resultTable() {
    const columns = [
      { label: 'Subject', x: leftX, width: pageWidth * 0.35 },
      { label: 'CA', x: leftX + pageWidth * 0.35, width: pageWidth * 0.12, align: 'center' },
      { label: 'Exam', x: leftX + pageWidth * 0.47, width: pageWidth * 0.12, align: 'center' },
      { label: 'Total', x: leftX + pageWidth * 0.59, width: pageWidth * 0.12, align: 'center' },
      { label: 'Grade', x: leftX + pageWidth * 0.71, width: pageWidth * 0.12, align: 'center' },
      { label: 'GP', x: leftX + pageWidth * 0.83, width: pageWidth * 0.17, align: 'center' },
    ];

    const tableTop = doc.y;
    const rowHeight = 20;
    const headerBg = '#e8edf3';

    doc.rect(leftX, tableTop, pageWidth, rowHeight).fill(headerBg);
    columns.forEach(col => {
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#1a3a5c')
        .text(col.label, col.x + 4, tableTop + 5, { width: col.width - 4, align: col.align || 'left' });
    });

    let y = tableTop + rowHeight;
    doc.font('Helvetica').fontSize(9).fillColor('#333');

    results.forEach((r, i) => {
      if (y > doc.page.height - 80) {
        doc.addPage();
        y = 50;
        doc.rect(leftX, y, pageWidth, rowHeight).fill(headerBg);
        columns.forEach(col => {
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#1a3a5c')
            .text(col.label, col.x + 4, y + 5, { width: col.width - 4, align: col.align || 'left' });
        });
        y += rowHeight;
      }

      if (i % 2 === 0) {
        doc.rect(leftX, y, pageWidth, rowHeight).fill('#f9fafb');
      }

      const gp = calculateGP(r.grade);
      const rowData = [
        r.subject_name,
        r.ca_score.toString(),
        r.exam_score.toString(),
        r.total.toString(),
        r.grade,
        gp.toFixed(1),
      ];

      columns.forEach((col, idx) => {
        doc.font(idx === 0 ? 'Helvetica' : 'Helvetica').fontSize(9).fillColor('#333')
          .text(rowData[idx], col.x + 4, y + 4, { width: col.width - 4, align: col.align || 'left' });
      });

      y += rowHeight;
    });

    doc.moveDown(1);
  }

  function approvalSection() {
    doc.moveDown(1);
    doc.strokeColor('#ccc').lineWidth(0.5).moveTo(leftX, doc.y).lineTo(rightX, doc.y).stroke();
    doc.moveDown(1);

    const startY = doc.y;
    const halfWidth = pageWidth / 2 - 10;
    const today = new Date().toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    doc.font('Helvetica').fontSize(10).fillColor('#333');
    doc.text(`Date Generated:`, leftX, startY, { width: halfWidth });
    doc.text(today, leftX, doc.y + 2, { width: halfWidth });
    doc.text(`Verification Code: ${verificationCode}`, leftX, doc.y + 4, { width: halfWidth });

    doc.fontSize(8).fillColor('#999');
    doc.text('This document was generated electronically by ' + school.school_short_name + '.', rightX - halfWidth, startY, { width: halfWidth, align: 'right' });
    doc.text('No signature is required for electronically generated results.', rightX - halfWidth, doc.y + 2, { width: halfWidth, align: 'right' });
  }

  function calculateGP(grade) {
    const gpMap = { A: 5.0, B: 4.0, C: 3.0, D: 2.0, E: 1.0, F: 0.0 };
    return gpMap[grade] || 0.0;
  }

  header();
  infoAndSummary();
  resultTable();
  approvalSection();

  doc.end();

  return new Promise(resolve => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
  });
}

module.exports = { generateResultPdf };