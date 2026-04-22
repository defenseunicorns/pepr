StrData = fread(stdin, 'char') ;
StrData = char( StrData.' ) ;
JsonData = jsondecode(StrData) ;

ax = plotyy (JsonData.x, JsonData.mem.y, JsonData.x, JsonData.rps.y) ;

xlabel (JsonData.label) ;

ylim (ax(1), "padded") ;
ylabel (ax(1), JsonData.mem.label) ;

ylim (ax(2), "padded") ;
ylabel (ax(2), JsonData.rps.label) ;

title (JsonData.title) ;
fname = [ JsonData.fname ".png" ] ;
print ("-dpng", fname) ;
