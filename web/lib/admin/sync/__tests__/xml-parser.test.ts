/**
 * XML Parser Tests
 *
 * Tests for parsing Texas Legislature bill history XML files.
 */

import { describe, it, expect } from 'vitest';
import { parseBillXml, ParsedBill } from '../xml-parser';

// Sample bill XML fixtures
const COMPLETE_BILL_XML = `<?xml version="1.0" encoding="UTF-8"?>
<billhistory bill="89(R) HB 1" lastUpdate="3/20/2025">
  <caption>General Appropriations Bill.</caption>
  <authors>Bonnen</authors>
  <coauthors>Kitzman | Lopez, Janie</coauthors>
  <sponsors>Hancock | Nelson</sponsors>
  <cosponsors>Birdwell</cosponsors>
  <subjects>
    <subject>State Finances--Appropriations (I0746)</subject>
    <subject>Education--Public Schools (E0321)</subject>
  </subjects>
  <lastaction>02/25/2025 H Referred to Appropriations</lastaction>
  <committees>
    <house name="Appropriations" status="In committee"/>
    <senate name="Finance" status="Reported"/>
  </committees>
  <actions>
    <action>
      <date>1/22/2025</date>
      <description>Filed</description>
    </action>
    <action>
      <date>2/15/2025</date>
      <description>Read first time</description>
    </action>
    <action>
      <date>2/25/2025</date>
      <description>Referred to Appropriations</description>
    </action>
  </actions>
  <billtext>
    <WebHTMLURL>http://capitol.texas.gov/tlodocs/89R/billtext/html/HB00001I.HTM</WebHTMLURL>
  </billtext>
</billhistory>`;

const SENATE_BILL_XML = `<?xml version="1.0" encoding="UTF-8"?>
<billhistory bill="89(R) SB 100" lastUpdate="4/15/2025">
  <caption>Relating to property tax relief.</caption>
  <authors>Hughes | Springer</authors>
  <coauthors></coauthors>
  <sponsors></sponsors>
  <cosponsors></cosponsors>
  <subjects>
    <subject>Taxation--Property Tax (T0456)</subject>
  </subjects>
  <lastaction>04/10/2025 S Passed to engrossment</lastaction>
  <committees>
    <senate name="Local Government" status="Reported"/>
  </committees>
  <actions>
    <action>
      <date>2/1/2025</date>
      <description>Filed</description>
    </action>
    <action>
      <date>4/5/2025</date>
      <description>Passed to engrossment</description>
    </action>
  </actions>
  <billtext>
    <WebHTMLURL>http://capitol.texas.gov/tlodocs/89R/billtext/html/SB00100I.HTM</WebHTMLURL>
  </billtext>
</billhistory>`;

const SIGNED_BILL_XML = `<?xml version="1.0" encoding="UTF-8"?>
<billhistory bill="89(R) HB 50" lastUpdate="6/1/2025">
  <caption>Education reform bill.</caption>
  <authors>Smith</authors>
  <coauthors></coauthors>
  <sponsors></sponsors>
  <cosponsors></cosponsors>
  <subjects>
    <subject>Education (E0001)</subject>
  </subjects>
  <lastaction>06/01/2025 Signed by the Governor</lastaction>
  <committees>
    <house name="Public Education" status="Reported"/>
    <senate name="Education" status="Reported"/>
  </committees>
  <actions>
    <action>
      <date>1/15/2025</date>
      <description>Filed</description>
    </action>
    <action>
      <date>5/25/2025</date>
      <description>Sent to the Governor</description>
    </action>
    <action>
      <date>6/1/2025</date>
      <description>Signed by the Governor</description>
    </action>
  </actions>
  <billtext>
    <WebHTMLURL>http://capitol.texas.gov/tlodocs/89R/billtext/html/HB00050F.HTM</WebHTMLURL>
  </billtext>
</billhistory>`;

const VETOED_BILL_XML = `<?xml version="1.0" encoding="UTF-8"?>
<billhistory bill="89(R) HB 999" lastUpdate="6/15/2025">
  <caption>Controversial bill.</caption>
  <authors>Jones</authors>
  <coauthors></coauthors>
  <sponsors></sponsors>
  <cosponsors></cosponsors>
  <subjects>
    <subject>General (G0001)</subject>
  </subjects>
  <lastaction>06/15/2025 Vetoed by the Governor</lastaction>
  <committees>
    <house name="State Affairs" status="Reported"/>
  </committees>
  <actions>
    <action>
      <date>1/10/2025</date>
      <description>Filed</description>
    </action>
    <action>
      <date>6/15/2025</date>
      <description>Vetoed by the Governor</description>
    </action>
  </actions>
  <billtext>
    <WebHTMLURL>http://capitol.texas.gov/tlodocs/89R/billtext/html/HB00999E.HTM</WebHTMLURL>
  </billtext>
</billhistory>`;

const JOINT_RESOLUTION_XML = `<?xml version="1.0" encoding="UTF-8"?>
<billhistory bill="89(R) HJR 1" lastUpdate="5/1/2025">
  <caption>Constitutional amendment relating to property taxes.</caption>
  <authors>Davis</authors>
  <coauthors>Garcia | Williams</coauthors>
  <sponsors></sponsors>
  <cosponsors></cosponsors>
  <subjects>
    <subject>Constitutional Amendments (C0100)</subject>
  </subjects>
  <lastaction>05/01/2025 H Referred to Ways and Means</lastaction>
  <committees>
    <house name="Ways and Means" status="In committee"/>
  </committees>
  <actions>
    <action>
      <date>2/1/2025</date>
      <description>Filed</description>
    </action>
    <action>
      <date>5/1/2025</date>
      <description>Referred to Ways and Means</description>
    </action>
  </actions>
  <billtext>
    <WebHTMLURL>http://capitol.texas.gov/tlodocs/89R/billtext/html/HJ00001I.HTM</WebHTMLURL>
  </billtext>
</billhistory>`;

const MINIMAL_BILL_XML = `<?xml version="1.0" encoding="UTF-8"?>
<billhistory bill="89(R) HB 5000" lastUpdate="1/25/2025">
  <caption>A simple bill.</caption>
  <authors>Author</authors>
  <coauthors/>
  <sponsors/>
  <cosponsors/>
  <subjects/>
  <lastaction></lastaction>
  <committees/>
  <actions/>
  <billtext/>
</billhistory>`;

const CASE_VARIANT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<BillHistory bill="89(R) HB 123" lastUpdate="3/1/2025">
  <caption>Bill with different case tag.</caption>
  <authors>TestAuthor</authors>
  <coauthors/>
  <sponsors/>
  <cosponsors/>
  <subjects/>
  <lastaction>03/01/2025 H Filed</lastaction>
  <committees/>
  <actions>
    <action>
      <date>3/1/2025</date>
      <description>Filed</description>
    </action>
  </actions>
  <billtext>
    <WebHTMLURL>http://capitol.texas.gov/test.htm</WebHTMLURL>
  </billtext>
</BillHistory>`;

describe('XML Parser', () => {
  describe('parseBillXml', () => {
    describe('basic parsing', () => {
      it('parses a complete bill XML correctly', () => {
        const result = parseBillXml(COMPLETE_BILL_XML);

        expect(result).not.toBeNull();
        expect(result!.billId).toBe('HB 1');
        expect(result!.billType).toBe('HB');
        expect(result!.billNumber).toBe(1);
        expect(result!.description).toBe('General Appropriations Bill.');
      });

      it('parses Senate bill correctly', () => {
        const result = parseBillXml(SENATE_BILL_XML);

        expect(result).not.toBeNull();
        expect(result!.billId).toBe('SB 100');
        expect(result!.billType).toBe('SB');
        expect(result!.billNumber).toBe(100);
      });

      it('parses Joint Resolution correctly', () => {
        const result = parseBillXml(JOINT_RESOLUTION_XML);

        expect(result).not.toBeNull();
        expect(result!.billId).toBe('HJR 1');
        expect(result!.billType).toBe('HJR');
        expect(result!.billNumber).toBe(1);
      });

      it('handles BillHistory tag case variant', () => {
        const result = parseBillXml(CASE_VARIANT_XML);

        expect(result).not.toBeNull();
        expect(result!.billId).toBe('HB 123');
      });
    });

    describe('author parsing', () => {
      it('parses single author', () => {
        const result = parseBillXml(COMPLETE_BILL_XML);

        expect(result!.authors).toHaveLength(1);
        expect(result!.authors[0]).toBe('Bonnen');
      });

      it('parses multiple authors with pipe separator', () => {
        const result = parseBillXml(SENATE_BILL_XML);

        expect(result!.authors).toHaveLength(2);
        expect(result!.authors).toContain('Hughes');
        expect(result!.authors).toContain('Springer');
      });

      it('parses coauthors correctly', () => {
        const result = parseBillXml(COMPLETE_BILL_XML);

        expect(result!.coauthors).toHaveLength(2);
        expect(result!.coauthors).toContain('Kitzman');
        expect(result!.coauthors).toContain('Lopez, Janie');
      });

      it('handles empty coauthors', () => {
        const result = parseBillXml(MINIMAL_BILL_XML);

        expect(result!.coauthors).toEqual([]);
      });

      it('parses sponsors and cosponsors', () => {
        const result = parseBillXml(COMPLETE_BILL_XML);

        expect(result!.sponsors).toHaveLength(2);
        expect(result!.sponsors).toContain('Hancock');
        expect(result!.sponsors).toContain('Nelson');
        expect(result!.cosponsors).toHaveLength(1);
        expect(result!.cosponsors[0]).toBe('Birdwell');
      });
    });

    describe('subject parsing', () => {
      it('parses multiple subjects and removes code suffixes', () => {
        const result = parseBillXml(COMPLETE_BILL_XML);

        expect(result!.subjects).toHaveLength(2);
        expect(result!.subjects).toContain('State Finances--Appropriations');
        expect(result!.subjects).toContain('Education--Public Schools');
        expect(result!.subjects.join('')).not.toContain('(I0746)');
      });

      it('handles empty subjects', () => {
        const result = parseBillXml(MINIMAL_BILL_XML);

        expect(result!.subjects).toEqual([]);
      });
    });

    describe('action parsing', () => {
      it('parses all actions with dates and descriptions', () => {
        const result = parseBillXml(COMPLETE_BILL_XML);

        expect(result!.actions).toHaveLength(3);
        expect(result!.actions[0]).toEqual({
          date: '1/22/2025',
          description: 'Filed',
        });
        expect(result!.actions[2]).toEqual({
          date: '2/25/2025',
          description: 'Referred to Appropriations',
        });
      });

      it('handles empty actions', () => {
        const result = parseBillXml(MINIMAL_BILL_XML);

        expect(result!.actions).toEqual([]);
      });
    });

    describe('committee parsing', () => {
      it('parses House committees', () => {
        const result = parseBillXml(COMPLETE_BILL_XML);

        const houseCommittee = result!.committees.find(c => c.chamber === 'house');
        expect(houseCommittee).toBeDefined();
        expect(houseCommittee!.name).toBe('Appropriations');
        expect(houseCommittee!.status).toBe('In committee');
      });

      it('parses Senate committees', () => {
        const result = parseBillXml(COMPLETE_BILL_XML);

        const senateCommittee = result!.committees.find(c => c.chamber === 'senate');
        expect(senateCommittee).toBeDefined();
        expect(senateCommittee!.name).toBe('Finance');
        expect(senateCommittee!.status).toBe('Reported');
      });

      it('handles empty committees', () => {
        const result = parseBillXml(MINIMAL_BILL_XML);

        expect(result!.committees).toEqual([]);
      });
    });

    describe('status derivation', () => {
      it('derives "In Committee" status correctly', () => {
        const result = parseBillXml(COMPLETE_BILL_XML);

        expect(result!.status).toBe('In Committee');
      });

      it('derives "Passed" status correctly', () => {
        const result = parseBillXml(SENATE_BILL_XML);

        expect(result!.status).toBe('Passed');
      });

      it('derives "Signed" status correctly', () => {
        const result = parseBillXml(SIGNED_BILL_XML);

        expect(result!.status).toBe('Signed');
      });

      it('derives "Vetoed" status correctly', () => {
        const result = parseBillXml(VETOED_BILL_XML);

        expect(result!.status).toBe('Vetoed');
      });

      it('defaults to "Filed" for minimal bill', () => {
        const result = parseBillXml(MINIMAL_BILL_XML);

        expect(result!.status).toBe('Filed');
      });
    });

    describe('date parsing', () => {
      it('parses lastUpdate date from attribute', () => {
        const result = parseBillXml(COMPLETE_BILL_XML);

        expect(result!.lastUpdate).toBeInstanceOf(Date);
        expect(result!.lastUpdate!.getMonth()).toBe(2); // March (0-indexed)
        expect(result!.lastUpdate!.getDate()).toBe(20);
        expect(result!.lastUpdate!.getFullYear()).toBe(2025);
      });

      it('parses lastActionDate from lastaction text', () => {
        const result = parseBillXml(COMPLETE_BILL_XML);

        expect(result!.lastActionDate).toBeInstanceOf(Date);
        expect(result!.lastActionDate!.getMonth()).toBe(1); // February
        expect(result!.lastActionDate!.getDate()).toBe(25);
        expect(result!.lastActionDate!.getFullYear()).toBe(2025);
      });

      it('handles single-digit month/day formats', () => {
        const result = parseBillXml(CASE_VARIANT_XML);

        expect(result!.lastActionDate).toBeInstanceOf(Date);
        expect(result!.lastActionDate!.getMonth()).toBe(2); // March
        expect(result!.lastActionDate!.getDate()).toBe(1);
      });

      it('handles null dates gracefully', () => {
        const result = parseBillXml(MINIMAL_BILL_XML);

        expect(result!.lastActionDate).toBeNull();
      });
    });

    describe('URL parsing', () => {
      it('parses WebHTMLURL correctly', () => {
        const result = parseBillXml(COMPLETE_BILL_XML);

        expect(result!.textUrl).toBe('http://capitol.texas.gov/tlodocs/89R/billtext/html/HB00001I.HTM');
      });

      it('handles missing URL', () => {
        const result = parseBillXml(MINIMAL_BILL_XML);

        expect(result!.textUrl).toBeNull();
      });
    });

    describe('error handling', () => {
      it('returns null for empty string', () => {
        expect(parseBillXml('')).toBeNull();
      });

      it('returns null for null input', () => {
        expect(parseBillXml(null as unknown as string)).toBeNull();
      });

      it('returns null for undefined input', () => {
        expect(parseBillXml(undefined as unknown as string)).toBeNull();
      });

      it('returns null for non-XML content', () => {
        expect(parseBillXml('This is not XML')).toBeNull();
      });

      it('returns null for XML without billhistory tag', () => {
        const invalidXml = '<?xml version="1.0"?><other>content</other>';
        expect(parseBillXml(invalidXml)).toBeNull();
      });

      it('returns null for XML without bill attribute', () => {
        const invalidXml = '<billhistory><caption>Test</caption></billhistory>';
        expect(parseBillXml(invalidXml)).toBeNull();
      });

      it('returns null for XML without caption', () => {
        const invalidXml = '<billhistory bill="89(R) HB 1"><authors>Test</authors></billhistory>';
        expect(parseBillXml(invalidXml)).toBeNull();
      });

      it('returns null for invalid bill type', () => {
        const invalidXml = `<billhistory bill="89(R) XX 1"><caption>Test</caption></billhistory>`;
        expect(parseBillXml(invalidXml)).toBeNull();
      });
    });

    describe('content limits', () => {
      it('truncates description at 2000 characters', () => {
        const longCaption = 'A'.repeat(3000);
        const xml = `<billhistory bill="89(R) HB 1" lastUpdate="1/1/2025">
          <caption>${longCaption}</caption>
          <authors>Test</authors>
        </billhistory>`;

        const result = parseBillXml(xml);

        expect(result).not.toBeNull();
        expect(result!.description.length).toBe(2000);
      });

      it('truncates lastAction at 500 characters', () => {
        const longAction = '01/01/2025 ' + 'B'.repeat(600);
        const xml = `<billhistory bill="89(R) HB 1" lastUpdate="1/1/2025">
          <caption>Test Bill</caption>
          <authors>Test</authors>
          <lastaction>${longAction}</lastaction>
        </billhistory>`;

        const result = parseBillXml(xml);

        expect(result).not.toBeNull();
        expect(result!.lastAction.length).toBe(500);
      });
    });

    describe('special characters and CDATA', () => {
      it('decodes HTML entities in text content', () => {
        const xml = `<billhistory bill="89(R) HB 1" lastUpdate="1/1/2025">
          <caption>Bill with &amp; and &lt;special&gt; &quot;characters&quot;</caption>
          <authors>O&apos;Brien</authors>
        </billhistory>`;

        const result = parseBillXml(xml);

        expect(result).not.toBeNull();
        expect(result!.description).toBe('Bill with & and <special> "characters"');
        expect(result!.authors[0]).toBe("O'Brien");
      });

      it('handles CDATA sections', () => {
        const xml = `<billhistory bill="89(R) HB 1" lastUpdate="1/1/2025">
          <caption><![CDATA[Bill with <special> characters]]></caption>
          <authors>Author</authors>
        </billhistory>`;

        const result = parseBillXml(xml);

        expect(result).not.toBeNull();
        expect(result!.description).toBe('Bill with <special> characters');
      });
    });
  });
});
